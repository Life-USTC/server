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

/**
 * Body budget every REST JSON route gets unless it opts up.
 *
 * The Workers isolate memory ceiling is reached while the body buffers, long
 * before any schema limit can reject it, so the budget has to be the default
 * rather than something each route remembers to ask for. Every declared
 * request schema fits inside it with room to spare: the widest non-bulk
 * payload is 500 section codes of 64 characters, about 34 KiB raw and about
 * 192 KiB if a client escapes every character as `\uXXXX`.
 */
export const ROUTE_JSON_BODY_DEFAULT_MAX_BYTES = 256 * 1024;

export type ParseRouteJsonBodyOptions = ParseRouteOptions & {
  /**
   * Raise or lower the body budget for a route whose payload is legitimately
   * bulk. Bodies above it are refused with 413 instead of being buffered.
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
    body = await readJsonBodyWithinLimit(
      request,
      options?.maxBytes ?? ROUTE_JSON_BODY_DEFAULT_MAX_BYTES,
    );
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
