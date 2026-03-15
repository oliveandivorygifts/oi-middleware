/**
 * @dependencies
 * - src/types.ts                     — MiddlewareFunction
 * - src/helpers/request-context.ts   — resolveRequestIds, getHeaderCaseInsensitive
 */

/**
 * Request context initialisation middleware.
 * Seeds the shared MiddlewareContext with correlation IDs, client IP, and route info
 * so downstream middleware and handlers have consistent request metadata.
 *
 * @module
 */

import { getHeaderCaseInsensitive, resolveRequestIds } from "../helpers/request-context.js";
import type { MiddlewareFunction } from "../types.js";

/** Populates correlation_id, request_id, IP, user-agent, route, method on context. */
export function withRequestContext(): MiddlewareFunction {
  return async (request, context, next) => {
    const requestUrl = new URL(request.url);
    const requestIds = resolveRequestIds(request);

    const forwardedForHeader = getHeaderCaseInsensitive(request.headers, "x-forwarded-for");
    const ipAddress =
      getHeaderCaseInsensitive(request.headers, "cf-connecting-ip") ||
      forwardedForHeader?.split(",")[0]?.trim() ||
      null;

    context.correlation_id = requestIds.correlation_id;
    context.request_id = requestIds.request_id;
    context.start_ms = Date.now();
    context.ip = ipAddress;
    context.user_agent = getHeaderCaseInsensitive(request.headers, "user-agent") || null;
    context.route = requestUrl.pathname;
    context.method = request.method;
    context.user_email = getHeaderCaseInsensitive(request.headers, "cf-access-authenticated-user-email") || null;
    context.user_id = getHeaderCaseInsensitive(request.headers, "cf-access-authenticated-user-id") || null;

    if (!context.state) {
      context.state = {};
    }

    return next();
  };
}
