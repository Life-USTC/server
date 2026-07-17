import { GraphQLError } from "graphql";
import { GRAPHQL_LIMITS } from "./constants";

export type GraphqlPageInput = {
  page?: number | null;
  pageSize?: number | null;
};

export function normalizeGraphqlPage(input: GraphqlPageInput | null = {}) {
  const page = input?.page ?? 1;
  const pageSize = input?.pageSize ?? GRAPHQL_LIMITS.defaultPageSize;

  if (page < 1 || page > GRAPHQL_LIMITS.page) {
    throw new GraphQLError(
      `page must be between 1 and ${GRAPHQL_LIMITS.page}.`,
      {
        extensions: { code: "BAD_USER_INPUT" },
      },
    );
  }
  if (pageSize < 1 || pageSize > GRAPHQL_LIMITS.pageSize) {
    throw new GraphQLError(
      `pageSize must be between 1 and ${GRAPHQL_LIMITS.pageSize}.`,
      { extensions: { code: "BAD_USER_INPUT" } },
    );
  }

  return { page, pageSize };
}

export function paginateGraphqlArray<T>(
  values: readonly T[],
  input: GraphqlPageInput | null = {},
) {
  const { page, pageSize } = normalizeGraphqlPage(input);
  const start = (page - 1) * pageSize;
  const total = values.length;

  return {
    data: values.slice(start, start + pageSize),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  };
}
