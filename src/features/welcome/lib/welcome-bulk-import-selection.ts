export function setSelectedSectionId(
  selectedIds: number[],
  sectionId: number,
  checked: boolean,
) {
  return checked
    ? Array.from(new Set([...selectedIds, sectionId]))
    : selectedIds.filter((id) => id !== sectionId);
}
