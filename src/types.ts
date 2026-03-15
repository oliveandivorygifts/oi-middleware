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

export interface D1StatementLike {
  bind(...values: unknown[]): D1StatementLike;
  run(): Promise<unknown>;
  first<T = unknown>(): Promise<T | null>;
  all<T = unknown>(): Promise<{ results?: T[] } | T[]>;
}

export interface D1DatabaseLike {
  prepare(sql: string): D1StatementLike;
}

export interface WorkerExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException?(): void;
}

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

export interface MiddlewareContext extends RequestContext {
  env: AppEnv;
  state: Record<string, unknown>;
}

export interface ApiError {
  code: string;
  message: string;
  status: number;
  details?: unknown;
  correlation_id?: string;
  headers?: HeadersInit;
}

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

export interface PaginationResult<TItem> {
  items: TItem[];
  next_cursor: string | null;
  total: number | null;
}

export type LogLevel = "debug" | "info" | "warn" | "error" | "security";

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

export interface LogSink {
  write(event: LogEvent): Promise<void>;
}

export interface RateLimitConfig {
  limit: number;
  window_seconds: number;
  key_fn?: (request: Request, context: MiddlewareContext) => string;
  table_name?: string;
  mode?: "d1" | "memory";
  skip?: (request: Request, context: MiddlewareContext) => boolean;
}

export interface AuthHmacConfig {
  secret_env_key: string;
  tolerance_seconds?: number;
  replay_protection?: boolean;
  skip?: (request: Request, context: MiddlewareContext) => boolean;
}

export type NextFunction = () => Promise<Response>;

export type MiddlewareFunction = (
  request: Request,
  context: MiddlewareContext,
  next: NextFunction,
) => Promise<Response>;

export type HandlerFunction = (request: Request, context: MiddlewareContext) => Promise<Response> | Response;
