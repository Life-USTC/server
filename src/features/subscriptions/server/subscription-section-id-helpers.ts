export function uniqueSectionIds(sectionIds: readonly number[]) {
  return Array.from(new Set(sectionIds));
}

export function mergeSectionIds(
  currentIds: readonly number[],
  nextIds: readonly number[],
) {
  return uniqueSectionIds([...currentIds, ...nextIds]);
}

export function removeSectionIds(
  currentIds: readonly number[],
  idsToRemove: readonly number[],
) {
  const removeSet = new Set(idsToRemove);
  return currentIds.filter((id) => !removeSet.has(id));
}
