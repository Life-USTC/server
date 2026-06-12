type LocalizedName = {
  namePrimary?: string | null;
  nameSecondary?: string | null;
  nameCn?: string | null;
  nameEn?: string | null;
};

export function courseDetailPrimaryName(item?: LocalizedName | null) {
  return item?.namePrimary ?? item?.nameCn ?? "";
}

export function courseDetailSecondaryName(item?: LocalizedName | null) {
  return item?.nameSecondary ?? item?.nameEn ?? "";
}

export function formatCatalogDetailMessage(
  template: string,
  values: Record<string, string>,
) {
  return Object.entries(values).reduce(
    (message, [key, value]) => message.replace(`{${key}}`, value),
    template,
  );
}

export function teacherNames(teachers: LocalizedName[]) {
  return teachers
    .map((teacher) => {
      const primary = courseDetailPrimaryName(teacher);
      const secondary = courseDetailSecondaryName(teacher);
      return secondary ? `${primary} (${secondary})` : primary;
    })
    .filter(Boolean)
    .join(", ");
}
