export type LocalizedName = {
  namePrimary?: string | null;
  nameCn?: string | null;
  nameEn?: string | null;
};

export function namePrimary(item?: LocalizedName | null) {
  return item?.namePrimary || item?.nameCn || item?.nameEn || "";
}

export function nameSecondary(
  item: LocalizedName | null | undefined,
  locale: string,
) {
  const primary = namePrimary(item);
  const candidates =
    locale === "zh-cn"
      ? [item?.nameEn, item?.nameCn]
      : [item?.nameCn, item?.nameEn];
  return candidates.find((value) => value && value !== primary) ?? "";
}
