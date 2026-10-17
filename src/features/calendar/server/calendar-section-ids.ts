/** Pure ID rules for the multi-section calendar export (no I/O). */
export const MAX_MULTI_SECTION_CALENDAR_IDS = 50;

/**
 * Canonical multi-section ID set: unique, ascending, and bounded. Returns
 * `null` when more than {@link MAX_MULTI_SECTION_CALENDAR_IDS} unique IDs.
 */
export function normalizeSectionCalendarIds(sectionIds: readonly number[]) {
  const unique = Array.from(new Set(sectionIds)).sort(
    (left, right) => left - right,
  );
  return unique.length > MAX_MULTI_SECTION_CALENDAR_IDS ? null : unique;
}
