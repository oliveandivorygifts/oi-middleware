/**
 * @dependencies
 * - src/types.ts              — D1DatabaseLike, LogEvent, LogSink
 * - src/middleware/logging.ts  — Uses ConsoleSink, D1EventLogsSink, writeLogWithFailSafe
 */

/**
 * Logging primitives: sinks, redaction, and safe serialisation.
 * Provides ConsoleSink and D1EventLogsSink so the logging middleware
 * can write events without coupling to a specific storage backend.
 *
 * @module
 */

import type { D1DatabaseLike, LogEvent, LogSink } from "../types.js";

const REDACTED_KEYS = [
  "authorization",
  "cookie",
  "set-cookie",
  "api_key",
  "apikey",
  "openai_api_key",
  "token",
  "secret",
  "password",
  "hmac_shared_secret",
  "stripe_secret_key",
  "stripe_webhook_secret",
  "google_places_api_key",
];

function shouldRedactKey(key: string): boolean {
  const keyLower = key.toLowerCase();
  return REDACTED_KEYS.some((sensitiveKey) => keyLower.includes(sensitiveKey));
}

/** Recursively replaces values of sensitive keys (tokens, secrets) with "[REDACTED]". */
export function redactSensitive(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => redactSensitive(entry));
  }

  if (typeof value !== "object") {
    return value;
  }

  const original = value as Record<string, unknown>;
  const sanitized: Record<string, unknown> = {};

  for (const [key, nestedValue] of Object.entries(original)) {
    if (shouldRedactKey(key)) {
      sanitized[key] = "[REDACTED]";
      continue;
    }

    sanitized[key] = redactSensitive(nestedValue);
  }

  return sanitized;
}

/** Truncates text to a maximum length to prevent oversized log entries. */
export function truncateText(text: string, maxLength = 2000): string {
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength - 3)}...`;
}

/** Redacts and serialises a value to JSON, truncating to prevent oversized D1 inserts. */
export function safeJsonStringify(value: unknown, maxLength = 16_000): string {
  const sanitized = redactSensitive(value);
  const jsonString = JSON.stringify(sanitized ?? {});
  if (!jsonString) {
    return "{}";
  }
  return truncateText(jsonString, maxLength);
}

function buildInsertValues(event: LogEvent) {
  return [
    crypto.randomUUID(),
    new Date().toISOString(),
    event.level,
    "api",
    event.action,
    event.correlation_id,
    event.user_email ?? null,
    event.user_id ?? null,
    null,
    null,
    event.message,
    safeJsonStringify(event.metadata ?? {}),
    event.request_id,
    "http",
    event.ip,
    event.duration_ms,
    event.method,
    event.route,
    event.status,
    safeJsonStringify(event.metadata ?? {}),
  ];
}

/** Writes log events to stdout as JSON, suitable for local development. */
export class ConsoleSink implements LogSink {
  async write(event: LogEvent): Promise<void> {
    console.log(
      JSON.stringify({
        created_at: new Date().toISOString(),
        ...event,
        metadata: redactSensitive(event.metadata ?? {}),
      }),
    );
  }
}

/** Persists log events to the D1 event_logs table for production observability. */
export class D1EventLogsSink implements LogSink {
  private readonly database: D1DatabaseLike;

  constructor(database: D1DatabaseLike) {
    this.database = database;
  }

  async write(event: LogEvent): Promise<void> {
    const statement = this.database.prepare(
      `INSERT INTO event_logs
      (id, created_at, level, source, action, correlation_id, user_email, user_id, entity_type, entity_id, message, data_json, request_id, event_type, ip_address, duration_ms, method, path, status_code, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );

    await statement.bind(...buildInsertValues(event)).run();
  }
}

/** Writes a log event, swallowing sink errors so logging never crashes a request. */
export async function writeLogWithFailSafe(sink: LogSink, event: LogEvent): Promise<void> {
  try {
    await sink.write(event);
  } catch (error) {
    console.warn("[@oliveandivorygifts/middleware] log sink failure", {
      correlation_id: event.correlation_id,
      code: "log_sink_failed",
      message: error instanceof Error ? truncateText(error.message, 300) : "Unknown sink error",
    });
  }
}
