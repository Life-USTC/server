export type CatalogNamed = {
  nameCn?: string | null;
  nameEn?: string | null;
  namePrimary?: string | null;
  nameSecondary?: string | null;
};

export function catalogPrimaryName(item: CatalogNamed | null | undefined) {
  return item?.namePrimary ?? item?.nameCn ?? "";
}

export function catalogEducationLevelName(
  item: CatalogNamed | null | undefined,
) {
  const name = catalogPrimaryName(item);
  return name ? `${name.charAt(0).toLocaleUpperCase()}${name.slice(1)}` : name;
}

export function catalogSecondaryName(item: CatalogNamed | null | undefined) {
  return item?.nameSecondary ?? item?.nameEn ?? "";
}

/**
 * Locale-aware entity title for lists/headers.
 * - zh-cn: primary (CN) only; secondary only if primary is missing
 * - en-us: always "EN (CN)" when both differ; otherwise whichever exists
 */
export function catalogLocalizedDisplayName(
  item: CatalogNamed | null | undefined,
  locale: string | null | undefined,
) {
  const primary = catalogPrimaryName(item);
  const secondary = catalogSecondaryName(item);
  if (locale === "en-us") {
    if (primary && secondary && primary !== secondary) {
      return `${primary} (${secondary})`;
    }
    return primary || secondary;
  }
  return primary || secondary;
}

export function catalogNames(items: CatalogNamed[]) {
  return items
    .map((item) => catalogPrimaryName(item))
    .filter(Boolean)
    .join(", ");
}

export function catalogLocalizedNames(
  items: CatalogNamed[],
  locale: string | null | undefined,
) {
  return items
    .map((item) => catalogLocalizedDisplayName(item, locale))
    .filter(Boolean)
    .join(", ");
}

export function catalogHref(
  path: string,
  params: Record<string, string | null | undefined>,
  page?: number,
) {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) searchParams.set(key, value);
  }
  if (page && page > 1) searchParams.set("page", String(page));

  const query = searchParams.toString();
  return query ? `${path}?${query}` : path;
}
