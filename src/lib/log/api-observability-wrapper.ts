import { apiRequestContext } from "@/lib/log/api-observability-context";
import {
  recordApiRequestError,
  recordApiRequestFinish,
} from "@/lib/log/api-observability-recording";

type ApiRouteHandler<TRequest extends Request, TArgs extends unknown[]> = (
  request: TRequest,
  ...args: TArgs
) => Response | Promise<Response>;

export function observedApiRoute<
  TRequest extends Request,
  TArgs extends unknown[],
>(handler: ApiRouteHandler<TRequest, TArgs>): ApiRouteHandler<TRequest, TArgs> {
  return async (request, ...args) => {
    const context = apiRequestContext(request);

    try {
      const response = await handler(request, ...args);
      recordApiRequestFinish({
        ...context,
        durationMs: Date.now() - context.startMs,
        status: response.status,
      });
      return response;
    } catch (error) {
      recordApiRequestError({
        ...context,
        durationMs: Date.now() - context.startMs,
        error,
      });
      throw error;
    }
  };
}
