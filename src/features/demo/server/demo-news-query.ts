import {
  collapsePublicationListSearchParams,
  publicationsQuerySchema,
} from "@/features/publications/lib/publication-read-request-schemas";

/** Same multi-value and first-scalar rules as the existing publication reader. */
export function parseDemoNewsQuery(url: URL, page = false) {
  const collapsed = collapsePublicationListSearchParams(url.searchParams);
  // Native page forms submit empty controls when clearing a filter draft.
  if (page)
    for (const key of ["type", "source", "organizationLevel", "query", "fold"])
      if (collapsed.get(key)?.trim() === "") collapsed.delete(key);
  return publicationsQuerySchema.safeParse(Object.fromEntries(collapsed));
}
