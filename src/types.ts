/**
 * @dependencies
 * - src/middleware/auth-hmac.ts       — Uses AuthHmacConfig, MiddlewareFunction
 * - src/middleware/rate-limit.ts      — Uses RateLimitConfig, MiddlewareFunction
 * - src/middleware/logging.ts         — Uses LogEvent, LogSink, MiddlewareFunction
 * - src/middleware/json-body.ts       — Uses MiddlewareFunction
 * - src/middleware/request-context.ts — Uses MiddlewareFunction
 * - src/middleware/cors.ts            — Uses MiddlewareFunction
 * - src/middleware/error-handling.ts  — Uses MiddlewareFunction
 * - src/helpers/json-error.ts         — Uses ApiError, MiddlewareContext
 * - src/pipeline.ts                   — Uses HandlerFunction, MiddlewareFunction, MiddlewareContext
 * - tests/pipeline.test.ts            — Uses MiddlewareContext, MiddlewareFunction
 */

/**
 * Shared type definitions for the middleware pipeline.
 * Centralises all interfaces so consumers and middleware layers agree on a single contract.
 *
 * @module
 */

/** Environment bindings available to every middleware and handler at the edge. */
export interface AppEnv {
  DB?: D1DatabaseLike;
  KV?: unknown;
  HMAC_SHARED_SECRET?: string;
  LOG_SAMPLE_RATE_INFO?: number | string;
  LOG_SAMPLE_RATE_DEBUG?: number | string;
  LOG_ALWAYS_LOG_SLOW_MS?: number | string;
  LOG_SINK?: LogSink;
  [key: string]: unknown;
}

/** Minimal D1 prepared-statement shape so middleware stays decoupled from Cloudflare's SDK types. */
export interface D1StatementLike {
  bind(...values: unknown[]): D1StatementLike;
  run(): Promise<unknown>;
  first<T = unknown>(): Promise<T | null>;
  all<T = unknown>(): Promise<{ results?: T[] } | T[]>;
}

/** Minimal D1 database shape so middleware stays decoupled from Cloudflare's SDK types. */
export interface D1DatabaseLike {
  prepare(sql: string): D1StatementLike;
}

/** Mirrors Cloudflare's ExecutionContext for fire-and-forget background work. */
export interface WorkerExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException?(): void;
}

/** Per-request identifiers and metadata populated by the request-context middleware. */
export interface RequestContext {
  correlation_id: string;
  request_id: string;
  start_ms: number;
  ip: string | null;
  user_agent: string | null;
  route: string;
  method: string;
  user_id?: string | null;
  user_email?: string | null;
}

/** Full context bag threaded through every middleware and handler in the pipeline. */
export interface MiddlewareContext extends RequestContext {
  env: AppEnv;
  state: Record<string, unknown>;
}

/** Structured error shape used by jsonError to build consistent error responses. */
export interface ApiError {
  code: string;
  message: string;
  status: number;
  details?: unknown;
  correlation_id?: string;
  headers?: HeadersInit;
}

/** Standard envelope returned by API endpoints so clients can branch on ok/error. */
export interface ApiResult<TData = unknown> {
  ok: boolean;
  data?: TData;
  error?: {
    code: string;
    message: string;
    correlation_id: string;
  };
  details?: unknown;
}

/** Cursor-based pagination wrapper for list endpoints. */
export interface PaginationResult<TItem> {
  items: TItem[];
  next_cursor: string | null;
  total: number | null;
}

/** Severity levels for structured log events. */
export type LogLevel = "debug" | "info" | "warn" | "error" | "security";

/** Single structured log record written by the logging middleware to a LogSink. */
export interface LogEvent {
  level: LogLevel;
  action: string;
  message: string;
  correlation_id: string;
  request_id: string;
  route: string;
  method: string;
  status: number;
  duration_ms: number;
  ip: string | null;
  user_agent: string | null;
  user_id?: string | null;
  user_email?: string | null;
  metadata?: Record<string, unknown>;
}

/** Pluggable destination for log events (D1, console, or custom). */
export interface LogSink {
  write(event: LogEvent): Promise<void>;
}

/** Configuration for the fixed-window rate limiter middleware. */
export interface RateLimitConfig {
  limit: number;
  window_seconds: number;
  key_fn?: (request: Request, context: MiddlewareContext) => string;
  table_name?: string;
  mode?: "d1" | "memory";
  skip?: (request: Request, context: MiddlewareContext) => boolean;
}

/** Configuration for the HMAC authentication middleware. */
export interface AuthHmacConfig {
  secret_env_key: string;
  tolerance_seconds?: number;
  replay_protection?: boolean;
  skip?: (request: Request, context: MiddlewareContext) => boolean;
}

/** Callback that advances execution to the next middleware in the pipeline. */
export type NextFunction = () => Promise<Response>;

/** A single middleware step that can inspect/modify the request, context, or response. */
export type MiddlewareFunction = (
  request: Request,
  context: MiddlewareContext,
  next: NextFunction,
) => Promise<Response>;

/** Terminal handler that produces the final Response after all middleware has run. */
export type HandlerFunction = (request: Request, context: MiddlewareContext) => Promise<Response> | Response;
