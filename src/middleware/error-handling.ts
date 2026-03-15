/**
 * @dependencies
 * - src/types.ts                    — MiddlewareFunction
 * - src/helpers/classify-error.ts   — classifyError
 * - src/helpers/json-error.ts       — jsonError
 */

/**
 * Top-level error boundary middleware.
 * Ensures unhandled throws always produce a structured JSON error instead of a raw 500.
 *
 * @module
 */

import { classifyError } from "../helpers/classify-error.js";
import { jsonError } from "../helpers/json-error.js";
import type { MiddlewareFunction } from "../types.js";

/** Catches unhandled errors and returns a structured JSON error response. */
export function withErrorHandling(): MiddlewareFunction {
  return async (_request, context, next) => {
    try {
      return await next();
    } catch (error) {
      const classifiedError = classifyError(error);
      context.state.unhandled_error = error;
      return jsonError(
        {
          status: classifiedError.status,
          code: classifiedError.code,
          message: classifiedError.message,
          details: classifiedError.details,
          headers: classifiedError.headers,
        },
        context,
      );
    }
  };
}
