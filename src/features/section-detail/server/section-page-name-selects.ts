export const localizedNameSelect = {
  nameCn: true,
  nameEn: true,
  namePrimary: true,
  nameSecondary: true,
} as const;

export const entityNameSelect = {
  id: true,
  ...localizedNameSelect,
} as const;
