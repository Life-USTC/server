/**
 * Normalize an upstream organizer label for exact identity matching.
 *
 * The source is a display string rather than an identifier. Unicode NFKC
 * handles visually equivalent full-width forms, whitespace is collapsed, and
 * case is folded. The resulting value is used only for equality; no fuzzy
 * matching or similarity search is performed.
 */
export function normalizeYoungOrganizerName(
  value: string | null | undefined,
): string | null {
  if (value == null) return null;
  const normalized = value
    .normalize("NFKC")
    .trim()
    .replace(/\s+/gu, " ")
    .toLowerCase();
  return normalized === "" ? null : normalized;
}

export function displayYoungOrganizerName(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/gu, " ");
}
