import type { z } from "zod";
import { normalizePagination, type PaginationOptions } from "./pagination";
import {
  type ParseRouteOptions,
  parseRouteInput,
} from "./route-validation-parsing";

export type ParseRouteQueryOptions = ParseRouteOptions & {
  pagination?: PaginationOptions;
};

function searchParamsInput<TSchema extends z.ZodObject>(
  searchParams: URLSearchParams,
  schema: TSchema,
) {
  return Object.fromEntries(
    Object.keys(schema.shape).map((key) => [
      key,
      searchParams.get(key) ?? undefined,
    ]),
  );
}

export function parseRouteSearchParams<TSchema extends z.ZodObject>(
  searchParams: URLSearchParams,
  schema: TSchema,
  message: string,
  options?: ParseRouteOptions,
): z.output<TSchema> | Response {
  return parseRouteInput(
    searchParamsInput(searchParams, schema),
    schema,
    message,
    options,
  );
}

export function parseRouteQuery<TSchema extends z.ZodObject>(
  searchParams: URLSearchParams,
  schema: TSchema,
  message: string,
  options?: ParseRouteQueryOptions,
):
  | {
      query: z.output<TSchema>;
      pagination: ReturnType<typeof normalizePagination>;
    }
  | Response {
  const query = parseRouteSearchParams(searchParams, schema, message, options);
  if (query instanceof Response) {
    return query;
  }

  return {
    query,
    pagination: normalizePagination({
      page: searchParams.get(options?.pagination?.pageParam ?? "page"),
      pageSize: searchParams.get(options?.pagination?.pageSizeParam ?? "limit"),
      defaultPage: options?.pagination?.defaultPage,
      defaultPageSize: options?.pagination?.defaultPageSize,
      maxPageSize: options?.pagination?.maxPageSize,
    }),
  };
}
