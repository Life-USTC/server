const SEMESTER_NAME_PATTERN = /^(\d{4})年(春|秋)季学期$/;

const SEASON_NAMES: Record<string, string> = {
  春: "Spring",
  秋: "Fall",
};

/**
 * Semesters only carry a Chinese name from upstream JW data; derive an
 * English display name ("2026年春季学期" -> "Spring 2026") for en-us pages,
 * falling back to the original name when the pattern does not match.
 */
export function formatSemesterName(locale: string, nameCn: string) {
  if (locale !== "en-us") return nameCn;
  const match = SEMESTER_NAME_PATTERN.exec(nameCn.trim());
  if (!match) return nameCn;
  return `${SEASON_NAMES[match[2]]} ${match[1]}`;
}
