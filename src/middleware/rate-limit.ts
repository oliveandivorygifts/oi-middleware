/**
 * @dependencies
 * - src/types.ts              — D1DatabaseLike, MiddlewareFunction, RateLimitConfig
 * - src/actions.ts            — OBSERVABILITY_ACTIONS
 * - src/helpers/json-error.ts — jsonError
 */

import { OBSERVABILITY_ACTIONS } from "../actions.js";
import { jsonError } from "../helpers/json-error.js";
import type { D1DatabaseLike, MiddlewareFunction, RateLimitConfig } from "../types.js";

const memoryRateLimitStore = new Map<string, number>();
const d1TablesEnsured = new Set<string>();

export function getWindowStartSeconds(nowMilliseconds: number, windowSeconds: number): number {
  const nowSeconds = Math.floor(nowMilliseconds / 1000);
  return Math.floor(nowSeconds / windowSeconds) * windowSeconds;
}

export function getRetryAfterSeconds(
  nowMilliseconds: number,
  windowStartSeconds: number,
  windowSeconds: number,
): number {
  return Math.max(1, windowSeconds - (Math.floor(nowMilliseconds / 1000) - windowStartSeconds));
}

async function ensureD1RateLimitTable(database: D1DatabaseLike, tableName: string): Promise<void> {
  if (d1TablesEnsured.has(tableName)) return;

  await database
    .prepare(
      `CREATE TABLE IF NOT EXISTS ${tableName} (
        bucket_key TEXT NOT NULL,
        window_start INTEGER NOT NULL,
        request_count INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (bucket_key, window_start)
      )`,
    )
    .run();

  d1TablesEnsured.add(tableName);
}

async function incrementD1Counter(
  database: D1DatabaseLike,
  tableName: string,
  bucketKey: string,
  windowStart: number,
): Promise<number> {
  await database
    .prepare(
      `INSERT INTO ${tableName} (bucket_key, window_start, request_count)
       VALUES (?, ?, 1)
       ON CONFLICT(bucket_key, window_start)
       DO UPDATE SET request_count = request_count + 1`,
    )
    .bind(bucketKey, windowStart)
    .run();

  const row = (await database
    .prepare(`SELECT request_count FROM ${tableName} WHERE bucket_key = ? AND window_start = ?`)
    .bind(bucketKey, windowStart)
    .first()) as { request_count?: number } | null;

  return Number(row?.request_count || 0);
}

function incrementMemoryCounter(bucketKey: string, windowStart: number): number {
  const key = `${bucketKey}:${windowStart}`;
  const nextCount = (memoryRateLimitStore.get(key) || 0) + 1;
  memoryRateLimitStore.set(key, nextCount);
  return nextCount;
}

export function withRateLimit(configuration: RateLimitConfig): MiddlewareFunction {
  const tableName = configuration.table_name || "api_rate_limits";

  return async (request, context, next) => {
    if (configuration.skip?.(request, context)) return next();
    const nowMilliseconds = Date.now();
    const bucketWindowStart = getWindowStartSeconds(nowMilliseconds, configuration.window_seconds);
    const retryAfterSeconds = getRetryAfterSeconds(nowMilliseconds, bucketWindowStart, configuration.window_seconds);
    const bucketKey = configuration.key_fn?.(request, context) || context.ip || "unknown";

    let currentCount = 0;

    try {
      if (configuration.mode === "memory") {
        currentCount = incrementMemoryCounter(bucketKey, bucketWindowStart);
      } else if (context.env.DB) {
        await ensureD1RateLimitTable(context.env.DB, tableName);
        currentCount = await incrementD1Counter(context.env.DB, tableName, bucketKey, bucketWindowStart);
      } else {
        console.warn("[@oliveandivorygifts/middleware] withRateLimit skipped because DB binding is missing");
        return next();
      }
    } catch (error) {
      context.state.rate_limit_action = OBSERVABILITY_ACTIONS.DB_ERROR;
      console.warn("[@oliveandivorygifts/middleware] rate limit storage failure", {
        correlation_id: context.correlation_id,
        message: error instanceof Error ? error.message : "Unknown storage error",
      });
      return next();
    }

    if (currentCount > configuration.limit) {
      context.state.rate_limit_action = OBSERVABILITY_ACTIONS.RATE_LIMIT_BLOCK;
      return jsonError(
        {
          status: 429,
          code: "rate_limited",
          message: "Too many requests, please wait",
          headers: {
            "retry-after": String(retryAfterSeconds),
          },
        },
        context,
      );
    }

    context.state.rate_limit_action = OBSERVABILITY_ACTIONS.RATE_LIMIT_OK;
    return next();
  };
}
