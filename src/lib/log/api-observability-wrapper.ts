import { completeApiRequestContext } from "@/lib/log/api-observability-context";
import {
  recordApiRequestError,
  recordApiRequestFinish,
} from "@/lib/log/api-observability-recording";

type ApiRouteHandler<TRequest extends Request, TArgs extends unknown[]> = (
  request: TRequest,
  ...args: TArgs
) => Response | Promise<Response>;

export function recordObservedApiResponse(request: Request, status: number) {
  const context = completeApiRequestContext(request);
  if (!context) return false;

  recordApiRequestFinish({
    ...context,
    durationMs: Date.now() - context.startMs,
    status,
  });
  return true;
}

export function recordObservedApiError(request: Request, error: unknown) {
  const context = completeApiRequestContext(request);
  if (!context) return false;

  recordApiRequestError({
    ...context,
    durationMs: Date.now() - context.startMs,
    error,
  });
  return true;
}

export function observedApiRoute<
  TRequest extends Request,
  TArgs extends unknown[],
>(handler: ApiRouteHandler<TRequest, TArgs>): ApiRouteHandler<TRequest, TArgs> {
  return async (request, ...args) => {
    try {
      const response = await handler(request, ...args);
      recordObservedApiResponse(request, response.status);
      return response;
    } catch (error) {
      recordObservedApiError(request, error);
      throw error;
    }
  };
}
