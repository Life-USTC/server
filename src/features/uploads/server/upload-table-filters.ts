import type { Prisma } from "@/generated/prisma/client";
import { ilike } from "@/lib/query-filter-helpers";
import { dateTableFilter, numberTableFilter } from "@/lib/table-filter-query";

export const uploadTableFilterKeys = [
  "filename",
  "size",
  "sizeOp",
  "sizeMax",
  "createdAt",
  "createdAtOp",
  "createdAtMax",
] as const;

export function uploadTableWhere(
  userId: string,
  filters: Record<string, string> = {},
): Prisma.UploadWhereInput {
  let size = numberTableFilter(filters, "size");
  if (
    size &&
    Object.values(size).some(
      (value) =>
        typeof value !== "number" ||
        !Number.isInteger(value) ||
        value < 0 ||
        value > 2147483647,
    )
  )
    size = { gt: 0, lt: 0 };
  return {
    userId,
    ...(filters.filename ? { filename: ilike(filters.filename) } : {}),
    size,
    createdAt: dateTableFilter(filters, "createdAt"),
  };
}
