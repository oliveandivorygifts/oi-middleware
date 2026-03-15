/**
 * @dependencies
 * - src/types.ts — HandlerFunction, MiddlewareContext, MiddlewareFunction
 */

import type { HandlerFunction, MiddlewareContext, MiddlewareFunction } from "./types.js";

export function compose(...middlewares: MiddlewareFunction[]): MiddlewareFunction[] {
  return middlewares;
}

export async function runPipeline(
  request: Request,
  context: MiddlewareContext,
  middlewares: MiddlewareFunction[],
  finalHandler: HandlerFunction,
): Promise<Response> {
  let middlewareIndex = -1;

  async function dispatch(nextIndex: number): Promise<Response> {
    if (nextIndex <= middlewareIndex) {
      throw new Error("next() called multiple times");
    }

    middlewareIndex = nextIndex;
    if (nextIndex === middlewares.length) {
      return Promise.resolve(finalHandler(request, context));
    }

    const middleware = middlewares[nextIndex];
    if (!middleware) {
      return Promise.resolve(finalHandler(request, context));
    }
    return middleware(request, context, () => dispatch(nextIndex + 1));
  }

  return dispatch(0);
}
