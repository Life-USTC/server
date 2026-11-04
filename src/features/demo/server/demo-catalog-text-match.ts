// The ordinary catalog uses ILIKE '%value%'. Match its wildcards/escapes with
// bounded dynamic programming instead of backtracking user-supplied patterns.
export function demoCatalogTextMatches(
  value: string | null,
  filter: string | null | undefined,
) {
  if (!filter) return true;
  if (value === null) return false;
  const text = [...value.toLowerCase()];
  let matches = [true, ...text.map(() => false)];
  let escaped = false;
  for (const char of `%${filter.toLowerCase()}%`) {
    if (!escaped && char === "\\") {
      escaped = true;
      continue;
    }
    const many = !escaped && char === "%";
    const one = !escaped && char === "_";
    const next = [many && matches[0]];
    for (let index = 1; index <= text.length; index++) {
      next[index] = many
        ? matches[index] || next[index - 1]
        : matches[index - 1] && (one || text[index - 1] === char);
    }
    matches = next;
    escaped = false;
  }
  return matches[text.length];
}
