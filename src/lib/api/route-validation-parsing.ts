import type { z } from "zod";
import { badRequest, handleRouteError } from "./responses";

export type ParseRouteOptions = {
  logErrors?: boolean;
};

export function routeValidationResponse(
  message: string,
  error: unknown,
  options?: ParseRouteOptions,
) {
  if (options?.logErrors) {
    return handleRouteError(message, error, 400);
  }

  return badRequest(message);
}

export function parseRouteInput<TSchema extends z.ZodTypeAny>(
  input: unknown,
  schema: TSchema,
  message: string,
  options?: ParseRouteOptions,
): z.output<TSchema> | Response {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return routeValidationResponse(message, parsed.error, options);
  }

  return parsed.data;
}
