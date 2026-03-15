/**
 * @dependencies
 * - src/types.ts — MiddlewareFunction
 */

/**
 * CORS middleware for handling cross-origin requests.
 * Responds to OPTIONS preflight and sets allow-origin on all responses.
 *
 * @module
 */

import type { MiddlewareFunction } from "../types.js";

/** Middleware that adds CORS headers and handles preflight requests. */
export function withCors(options?: { allow_origin?: string; allow_methods?: string[] }): MiddlewareFunction {
  return async (request, context, next) => {
    const allowOrigin = options?.allow_origin || "*";
    const allowMethods = options?.allow_methods?.join(", ") || "GET, HEAD, POST, OPTIONS, PUT, DELETE";

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "access-control-allow-origin": allowOrigin,
          "access-control-allow-methods": allowMethods,
          "access-control-allow-headers":
            "content-type, x-oi-timestamp, x-oi-nonce, x-oi-signature, x-correlation-id, authorization",
          "access-control-max-age": "86400",
          "x-correlation-id": context.correlation_id,
          "x-request-id": context.request_id,
        },
      });
    }

    const response = await next();
    response.headers.set("access-control-allow-origin", allowOrigin);
    return response;
  };
}
