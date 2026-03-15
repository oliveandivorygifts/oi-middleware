/**
 * @dependencies
 * - src/types.ts              — MiddlewareFunction
 * - src/helpers/json-error.ts — jsonError
 */

import type { MiddlewareFunction } from "../types.js";
import { jsonError } from "./json-error.js";

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
