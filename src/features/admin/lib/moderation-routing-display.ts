import type { ModerationTab } from "@/features/admin/lib/moderation-display-types";

export function moderationHref(
  tab: ModerationTab,
  filters: {
    search?: string | null;
    status?: string | null;
    descriptionTarget?: string | null;
    descriptionContent?: string | null;
  },
) {
  const params = new URLSearchParams({ tab });
  if (filters.search) params.set("search", filters.search);
  if (filters.status) params.set("status", filters.status);
  if (filters.descriptionTarget) {
    params.set("descriptionTarget", filters.descriptionTarget);
  }
  if (filters.descriptionContent) {
    params.set("descriptionContent", filters.descriptionContent);
  }
  return `/admin/moderation?${params.toString()}`;
}
