import type { z } from "zod";
import { resourceIdPathParamsSchema } from "@/lib/api/schemas/request-schemas";
import { payloadTooLarge } from "./responses";
import {
  RouteBodyTooLargeError,
  readJsonBodyWithinLimit,
} from "./route-body-limit";
import {
  type ParseRouteOptions,
  parseRouteInput,
  routeValidationResponse,
} from "./route-validation-parsing";

export type ParseRouteJsonBodyOptions = ParseRouteOptions & {
  /**
   * Refuse bodies above this many bytes with 413 instead of buffering them.
   * Routes that accept bulk payloads must set it: the Workers isolate memory
   * ceiling is reached while `request.json()` buffers, long before any schema
   * limit can reject the payload.
   */
  maxBytes?: number;
};

export async function parseRouteParams<TSchema extends z.ZodTypeAny>(
  params: Promise<unknown>,
  schema: TSchema,
  message: string,
  options?: ParseRouteOptions,
): Promise<z.output<TSchema> | Response> {
  return parseRouteInput(await params, schema, message, options);
}

export async function parseRouteJsonBody<TSchema extends z.ZodTypeAny>(
  request: Request,
  schema: TSchema,
  message: string,
  options?: ParseRouteJsonBodyOptions,
): Promise<z.output<TSchema> | Response> {
  let body: unknown = {};

  try {
    body =
      options?.maxBytes === undefined
        ? await request.json()
        : await readJsonBodyWithinLimit(request, options.maxBytes);
  } catch (error) {
    if (error instanceof RouteBodyTooLargeError) {
      return payloadTooLarge(error.message);
    }
    return routeValidationResponse(message, error, {
      ...options,
      logErrors: true,
    });
  }

  return parseRouteInput(body, schema, message, {
    ...options,
    logErrors: options?.logErrors ?? true,
  });
}

/**
 * Parse a `[id]` path param using the canonical resourceIdPathParamsSchema.
 * Replaces duplicated parseCommentId / parseHomeworkId / parseTodoId / parseUploadId helpers.
 */
export async function parseResourceIdParam(
  params: Promise<{ id: string }>,
  label: string,
): Promise<string | Response> {
  const parsed = await parseRouteParams(
    params,
    resourceIdPathParamsSchema,
    `Invalid ${label} ID`,
  );
  if (parsed instanceof Response) {
    return parsed;
  }

  return parsed.id;
}
