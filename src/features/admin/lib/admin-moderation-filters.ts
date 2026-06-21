export const ADMIN_COMMENT_STATUS_FILTERS = [
  "all",
  "active",
  "softbanned",
  "deleted",
  "suspended",
] as const;

export type AdminCommentStatusFilter =
  (typeof ADMIN_COMMENT_STATUS_FILTERS)[number];

const ADMIN_COMMENT_STATUS_FILTER_SET = new Set<string>(
  ADMIN_COMMENT_STATUS_FILTERS,
);

export function normalizeAdminCommentStatusFilter(
  value: string | null | undefined,
): AdminCommentStatusFilter {
  return ADMIN_COMMENT_STATUS_FILTER_SET.has(value ?? "")
    ? (value as AdminCommentStatusFilter)
    : "active";
}
