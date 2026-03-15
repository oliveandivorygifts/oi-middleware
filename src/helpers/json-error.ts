/**
 * @dependencies
 * - src/types.ts — ApiError, MiddlewareContext
 */

import type { ApiError, MiddlewareContext } from "../types.js";

export function attachRequestHeaders(
  response: Response,
  context?: Pick<MiddlewareContext, "correlation_id" | "request_id">,
): Response {
  if (context?.correlation_id) {
    response.headers.set("x-correlation-id", context.correlation_id);
  }
  if (context?.request_id) {
    response.headers.set("x-request-id", context.request_id);
  }
  return response;
}

export function jsonOk(
  data: unknown,
  status = 200,
  context?: Pick<MiddlewareContext, "correlation_id" | "request_id">,
): Response {
  const response = new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });
  return attachRequestHeaders(response, context);
}

export function jsonError(
  error: ApiError,
  context?: Pick<MiddlewareContext, "correlation_id" | "request_id">,
): Response {
  const correlationId = error.correlation_id || context?.correlation_id || "";
  const headers = new Headers({
    "content-type": "application/json",
  });

  if (error.headers) {
    const extraHeaders = new Headers(error.headers);
    for (const [key, value] of extraHeaders.entries()) {
      headers.set(key, value);
    }
  }

  const body = {
    ok: false,
    error: {
      code: error.code,
      message: error.message,
      correlation_id: correlationId,
    },
    details: error.details,
  };

  const response = new Response(JSON.stringify(body), {
    status: error.status,
    headers,
  });

  if (correlationId) {
    response.headers.set("x-correlation-id", correlationId);
  }
  if (context?.request_id) {
    response.headers.set("x-request-id", context.request_id);
  }

  return response;
}

export function noContent(context?: Pick<MiddlewareContext, "correlation_id" | "request_id">): Response {
  const response = new Response(null, { status: 204 });
  return attachRequestHeaders(response, context);
}

export function redirect(
  url: string,
  status = 302,
  context?: Pick<MiddlewareContext, "correlation_id" | "request_id">,
): Response {
  const response = new Response(null, {
    status,
    headers: { location: url },
  });
  return attachRequestHeaders(response, context);
}
