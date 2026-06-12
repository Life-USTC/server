type LocalizedName = {
  nameCn?: string | null;
  nameEn?: string | null;
  namePrimary?: string | null;
  nameSecondary?: string | null;
};

export function formatWelcomeCopy(
  value: string,
  params: Record<string, number | string>,
) {
  return value.replace(/\{(\w+)\}/g, (match, key) =>
    params[key] === undefined ? match : String(params[key]),
  );
}

function primaryWelcomeName(
  item: LocalizedName | null | undefined,
  locale: string,
) {
  if (!item) return "";
  if (item.namePrimary) return item.namePrimary;
  return locale === "en-us"
    ? item.nameEn || item.nameCn || ""
    : item.nameCn || item.nameEn || "";
}

function secondaryWelcomeName(
  item: LocalizedName | null | undefined,
  locale: string,
) {
  if (!item) return "";
  if (item.nameSecondary) return item.nameSecondary;
  const primary = primaryWelcomeName(item, locale);
  const secondary = locale === "en-us" ? item.nameCn : item.nameEn;
  return secondary && secondary !== primary ? secondary : "";
}

export function displayWelcomeName(
  item: LocalizedName | null | undefined,
  locale: string,
) {
  const primary = primaryWelcomeName(item, locale);
  const secondary = secondaryWelcomeName(item, locale);
  return secondary ? `${primary} (${secondary})` : primary;
}
