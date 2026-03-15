/**
 * @dependencies
 * - src/types.ts            — D1DatabaseLike, LogEvent, LogSink, MiddlewareFunction
 * - src/actions.ts          — OBSERVABILITY_ACTIONS
 * - src/helpers/logging.ts  — ConsoleSink, D1EventLogsSink, writeLogWithFailSafe
 */

/**
 * Request/response logging middleware.
 * Emits one structured log event per request to D1, console, or a custom sink,
 * with sampling to control volume in high-traffic environments.
 *
 * @module
 */

import { OBSERVABILITY_ACTIONS } from "../actions.js";
import { ConsoleSink, D1EventLogsSink, writeLogWithFailSafe } from "../helpers/logging.js";
import type { D1DatabaseLike, LogEvent, LogSink, MiddlewareFunction } from "../types.js";

function parseSampleRate(value: unknown, fallback: number): number {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return fallback;
  }
  return Math.min(1, Math.max(0, numericValue));
}

function parseInteger(value: unknown, fallback: number): number {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return fallback;
  }
  return numericValue;
}

function sanitizeActionSegment(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "unknown"
  );
}

function isLikelyIdentifierSegment(value: string): boolean {
  return (
    /^[0-9]+$/.test(value) ||
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value) ||
    /^[a-z0-9_-]{16,}$/i.test(value)
  );
}

function routeToActionSegment(route: string): string {
  const segments = route
    .split("/")
    .filter(Boolean)
    .map((segment) => (isLikelyIdentifierSegment(segment) ? "id" : sanitizeActionSegment(segment)))
    .filter(Boolean);

  return segments.join("_") || "root";
}

function pruneEmpty(value: unknown): unknown {
  if (value === null || value === undefined) {
    return undefined;
  }

  if (Array.isArray(value)) {
    const items = value.map((item) => pruneEmpty(item)).filter((item) => item !== undefined);
    return items.length > 0 ? items : undefined;
  }

  if (typeof value !== "object") {
    return value;
  }

  const next: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    const cleaned = pruneEmpty(nested);
    if (cleaned !== undefined) {
      next[key] = cleaned;
    }
  }

  return Object.keys(next).length > 0 ? next : undefined;
}

function deterministicHashToUnitInterval(input: string): number {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }

  return (hash >>> 0) / 4294967295;
}

function resolveSink(context: { env: Record<string, unknown> }, explicitSink?: LogSink): LogSink {
  if (explicitSink) {
    return explicitSink;
  }

  const environmentSink = context.env.LOG_SINK;
  if (environmentSink && typeof (environmentSink as LogSink).write === "function") {
    return environmentSink as LogSink;
  }

  if (context.env.DB) {
    return new D1EventLogsSink(context.env.DB as D1DatabaseLike);
  }

  return new ConsoleSink();
}

function shouldLog(
  level: "info" | "warn" | "error",
  requestId: string,
  durationMs: number,
  context: { env: Record<string, unknown> },
): boolean {
  if (level === "warn" || level === "error") {
    return true;
  }

  const slowThresholdMilliseconds = parseInteger(context.env.LOG_ALWAYS_LOG_SLOW_MS, 1500);
  if (durationMs >= slowThresholdMilliseconds) {
    return true;
  }

  const infoSampleRate = parseSampleRate(context.env.LOG_SAMPLE_RATE_INFO, 1);
  const sampleBucket = deterministicHashToUnitInterval(requestId);
  return sampleBucket <= infoSampleRate;
}

/** Middleware that logs HTTP requests to D1, console, or a custom sink. */
export function withLogging(options?: { action_prefix?: string; sink?: LogSink }): MiddlewareFunction {
  return async (request, context, next) => {
    const requestStart = Date.now();
    let response: Response | null = null;
    let unhandledError: unknown = null;

    try {
      response = await next();
      return response;
    } catch (error) {
      unhandledError = error;
      throw error;
    } finally {
      if (!context.state.__request_logged) {
        context.state.__request_logged = true;

        const requestDuration = Date.now() - requestStart;
        const statusCode = response?.status ?? 500;
        const level = statusCode >= 500 ? "error" : statusCode >= 400 ? "warn" : "info";
        const resolvedRequestId = context.request_id || context.correlation_id || crypto.randomUUID();

        if (shouldLog(level, resolvedRequestId, requestDuration, context)) {
          let responseJson: unknown = null;
          if (response && (response.headers.get("content-type") || "").includes("application/json")) {
            try {
              responseJson = await response.clone().json();
            } catch {
              responseJson = null;
            }
          }

          const actionPrefix = sanitizeActionSegment(options?.action_prefix || "http");
          const methodSegment = sanitizeActionSegment(context.method || request.method || "get");
          const routeSegment = routeToActionSegment(context.route || new URL(request.url).pathname);
          const outcomeSegment = statusCode >= 500 || unhandledError ? "error" : statusCode >= 400 ? "warn" : "ok";
          const action = `${actionPrefix}.${methodSegment}.${routeSegment}.${outcomeSegment}`;
          const metadata = pruneEmpty({
            request_json: {
              query: Object.fromEntries(new URL(request.url).searchParams.entries()),
              parsed_body_keys:
                context.state.parsed_body && typeof context.state.parsed_body === "object"
                  ? Object.keys(context.state.parsed_body as Record<string, unknown>)
                  : [],
            },
            response_json: responseJson,
            auth_action: context.state.auth_action,
            rate_limit_action: context.state.rate_limit_action,
            user_agent: context.user_agent,
            ip_address: context.ip,
            legacy_action:
              statusCode >= 500 || unhandledError
                ? OBSERVABILITY_ACTIONS.HTTP_ERROR
                : OBSERVABILITY_ACTIONS.HTTP_RESPONSE,
          }) as Record<string, unknown> | undefined;

          const logEvent: LogEvent = {
            level,
            action,
            message: `${context.method} ${context.route} -> ${statusCode}`,
            correlation_id: context.correlation_id,
            request_id: resolvedRequestId,
            route: context.route,
            method: context.method,
            status: statusCode,
            duration_ms: requestDuration,
            ip: context.ip,
            user_agent: context.user_agent,
            user_id: context.user_id || null,
            user_email: context.user_email || null,
            metadata,
          };

          await writeLogWithFailSafe(resolveSink(context, options?.sink), logEvent);
        }
      }
    }
  };
}
