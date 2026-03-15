/**
 * @dependencies
 * - src/types.ts              — HandlerFunction, MiddlewareContext, MiddlewareFunction, WorkerExecutionContext
 * - src/pipeline.ts           — runPipeline
 * - src/helpers/json-error.ts — attachRequestHeaders
 */

import { attachRequestHeaders } from "../helpers/json-error.js";
import { runPipeline } from "../pipeline.js";
import type { HandlerFunction, MiddlewareContext, MiddlewareFunction, WorkerExecutionContext } from "../types.js";

export function cloudflare<Env = unknown>(
  middlewares: MiddlewareFunction[],
  handler: (
    request: Request,
    env: Env,
    middlewareContext: MiddlewareContext,
    executionContext?: WorkerExecutionContext,
  ) => Promise<Response> | Response,
) {
  return async (request: Request, env: Env, executionContext?: WorkerExecutionContext): Promise<Response> => {
    const middlewareContext: MiddlewareContext = {
      correlation_id: "",
      request_id: "",
      start_ms: Date.now(),
      ip: null,
      user_agent: null,
      route: "",
      method: "",
      env: (env as Record<string, unknown>) || {},
      state: {},
    };

    const finalHandler: HandlerFunction = (finalRequest, finalContext) => {
      return handler(finalRequest, env, finalContext, executionContext);
    };

    const response = await runPipeline(request, middlewareContext, middlewares, finalHandler);
    return attachRequestHeaders(response, middlewareContext);
  };
}

export const withCloudflarePipeline = cloudflare;
