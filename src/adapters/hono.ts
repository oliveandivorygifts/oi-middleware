/**
 * @dependencies
 * - src/types.ts              — HandlerFunction, MiddlewareContext, MiddlewareFunction
 * - src/pipeline.ts           — runPipeline
 * - src/helpers/json-error.ts — attachRequestHeaders
 */

/**
 * Hono framework adapter.
 * Bridges the middleware pipeline into Hono's middleware signature
 * so the API worker can use shared middleware without framework lock-in.
 *
 * @module
 */

import type { MiddlewareHandler } from "hono";
import { attachRequestHeaders } from "../helpers/json-error.js";
import { runPipeline } from "../pipeline.js";
import type { HandlerFunction, MiddlewareContext, MiddlewareFunction } from "../types.js";

/** Wraps the middleware pipeline as a Hono MiddlewareHandler. */
export function hono(middlewares: MiddlewareFunction[]): MiddlewareHandler {
  return async (honoContext, next) => {
    const middlewareContext: MiddlewareContext = {
      correlation_id: honoContext.get("correlation_id") || "",
      request_id: honoContext.get("request_id") || "",
      start_ms: Date.now(),
      ip: honoContext.req.header("cf-connecting-ip") || honoContext.req.header("x-forwarded-for") || null,
      user_agent: honoContext.req.header("user-agent") || null,
      route: new URL(honoContext.req.url).pathname,
      method: honoContext.req.method,
      user_email: honoContext.get("user_email") || honoContext.req.header("cf-access-authenticated-user-email") || null,
      user_id: honoContext.get("user_id") || honoContext.req.header("cf-access-authenticated-user-id") || null,
      env: (honoContext.env as Record<string, unknown>) || {},
      state: {},
    };

    const finalHandler: HandlerFunction = async () => {
      await next();
      return honoContext.res;
    };

    const response = await runPipeline(honoContext.req.raw, middlewareContext, middlewares, finalHandler);
    const responseWithHeaders = attachRequestHeaders(response, middlewareContext);
    honoContext.res = responseWithHeaders;
  };
}

/** Alias for hono() to match the withX naming convention used elsewhere. */
export const withHonoPipeline = hono;
