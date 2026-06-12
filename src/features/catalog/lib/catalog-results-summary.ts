export function catalogShowingSummary(
  template: string,
  count: number,
  total: number,
) {
  return template
    .replace("{count}", String(count))
    .replace("{total}", String(total));
}

export function optionalCatalogFilterSummary(
  value: string | null | undefined,
  template: string,
  token: string,
) {
  return value ? template.replace(token, value) : "";
}
