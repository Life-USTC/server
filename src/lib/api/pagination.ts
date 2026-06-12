import { parseInteger } from "./request-integers";

export type PaginatedResponse<T> = {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

export type PaginationInput = {
  page?: number | string | null;
  pageSize?: number | string | null;
  defaultPage?: number;
  defaultPageSize?: number;
  maxPageSize?: number;
};

export type PaginationOptions = Pick<
  PaginationInput,
  "defaultPage" | "defaultPageSize" | "maxPageSize"
> & {
  pageParam?: string;
  pageSizeParam?: string;
};

/**
 * Normalize pagination values from query params or parsed route input.
 */
export function normalizePagination(input: PaginationInput = {}) {
  const page = Math.max(parseInteger(input.page) ?? input.defaultPage ?? 1, 1);
  const pageSize = Math.min(
    Math.max(parseInteger(input.pageSize) ?? input.defaultPageSize ?? 20, 1),
    input.maxPageSize ?? 100,
  );
  return {
    page,
    pageSize,
    skip: (page - 1) * pageSize,
  };
}

/**
 * Build a standard `{ data, pagination }` API response envelope.
 */
export function buildPaginatedResponse<T>(
  data: T[],
  page: number,
  pageSize: number,
  total: number,
): PaginatedResponse<T> {
  return {
    data,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  };
}
