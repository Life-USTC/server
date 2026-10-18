/**
 * Directory "last published" copy. Never show the empty-state「暂无发布」when
 * the source already has readable content (count > 0) but no dated revision.
 */
export function publicationSourceLastPublishedLabel(
  lastPublishedAt: Date | string | null,
  publicationCount: number,
  neverPublished: string,
  formatDate: (value: Date | string) => string,
): string | null {
  if (lastPublishedAt) return formatDate(lastPublishedAt);
  if (publicationCount > 0) return null;
  return neverPublished;
}
