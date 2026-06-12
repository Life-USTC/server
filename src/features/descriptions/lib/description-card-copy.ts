export function formatDescriptionCopy(
  value: string,
  params: Record<string, string>,
) {
  return value.replace(/\{(\w+)\}/g, (match, key) =>
    params[key] === undefined ? match : params[key],
  );
}
