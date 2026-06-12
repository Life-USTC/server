export type CatalogNamed = {
  nameCn?: string | null;
  nameEn?: string | null;
  namePrimary?: string | null;
  nameSecondary?: string | null;
};

export function catalogPrimaryName(item: CatalogNamed | null | undefined) {
  return item?.namePrimary ?? item?.nameCn ?? "";
}

export function catalogSecondaryName(item: CatalogNamed | null | undefined) {
  return item?.nameSecondary ?? item?.nameEn ?? "";
}

export function catalogNames(items: CatalogNamed[]) {
  return items
    .map((item) => catalogPrimaryName(item))
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
