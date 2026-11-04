export function uniqueSectionIds(sectionIds: readonly number[]) {
  return Array.from(new Set(sectionIds));
}
