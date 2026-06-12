export function toggleSelectedSectionId(
  selectedIds: number[],
  selectedIdSet: Set<number>,
  sectionId: number,
) {
  return selectedIdSet.has(sectionId)
    ? selectedIds.filter((id) => id !== sectionId)
    : [...selectedIds, sectionId];
}

export function setSelectedSectionId(
  selectedIds: number[],
  sectionId: number,
  checked: boolean,
) {
  return checked
    ? Array.from(new Set([...selectedIds, sectionId]))
    : selectedIds.filter((id) => id !== sectionId);
}
