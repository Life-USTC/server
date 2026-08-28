function normalizeLocalizedName(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function localizedNamePrimary(
  locale: string,
  nameCn: string,
  nameEn?: string | null,
) {
  const english = normalizeLocalizedName(nameEn);
  return locale === "en-us" && english ? english : nameCn;
}

export function localizedNameSecondary(
  locale: string,
  nameCn: string,
  nameEn?: string | null,
) {
  const english = normalizeLocalizedName(nameEn);
  return locale === "en-us" ? (english ? nameCn : null) : english;
}

export function toLocalizedNameDto(
  input: { nameCn: string; nameEn: string | null },
  locale: string,
) {
  return {
    nameCn: input.nameCn,
    nameEn: input.nameEn,
    namePrimary: localizedNamePrimary(locale, input.nameCn, input.nameEn),
    nameSecondary: localizedNameSecondary(locale, input.nameCn, input.nameEn),
  };
}
