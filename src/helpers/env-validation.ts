/**
 * @dependencies
 * - src/types.ts              — MiddlewareFunction
 * - src/helpers/json-error.ts — jsonError
 */

/**
 * Environment binding validation middleware.
 * Fails fast with a clear error when required env vars are missing,
 * instead of letting handlers crash with cryptic runtime errors.
 *
 * @module
 */

import type { MiddlewareFunction } from "../types.js";
import { jsonError } from "./json-error.js";

/** Middleware that rejects requests when required environment bindings are absent. */
export function withEnvValidation(requiredKeys: string[]): MiddlewareFunction {
  return async (_request, context, next) => {
    const missingKeys = requiredKeys.filter((key) => !context.env[key]);
    if (missingKeys.length > 0) {
      return jsonError(
        {
          status: 500,
          code: "misconfiguration",
          message: `Server missing required env bindings: ${missingKeys.join(", ")}`,
        },
        context,
      );
    }

    return next();
  };
}
