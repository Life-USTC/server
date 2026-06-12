export const MCP_DATE_FILTER_USAGE =
  "Use YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS+08:00.";

const DATE_ONLY_INPUT_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isDateOnlyInput(value: unknown) {
  return (
    typeof value === "string" && DATE_ONLY_INPUT_PATTERN.test(value.trim())
  );
}
