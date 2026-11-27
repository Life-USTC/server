import {
  buildPaginatedResponse,
  normalizePagination,
  type PaginatedResponse,
} from "@/lib/pagination";

/** Generic paginated query function for Prisma models. */
export async function paginatedQuery<TData>(
  queryFn: (skip: number, take: number) => Promise<TData[]>,
  countFn: () => Promise<number>,
  page: number,
  pageSize?: number,
  options: { inferShortFirstPageTotal?: boolean } = {},
): Promise<PaginatedResponse<TData>> {
  const normalized = normalizePagination({ page, pageSize });

  if (options.inferShortFirstPageTotal && normalized.page === 1) {
    const data = await queryFn(0, normalized.pageSize);
    const total =
      data.length < normalized.pageSize ? data.length : await countFn();
    return buildPaginatedResponse(
      data,
      normalized.page,
      normalized.pageSize,
      total,
    );
  }

  const [data, total] = await Promise.all([
    queryFn(normalized.skip, normalized.pageSize),
    countFn(),
  ]);

  return buildPaginatedResponse(
    data,
    normalized.page,
    normalized.pageSize,
    total,
  );
}
