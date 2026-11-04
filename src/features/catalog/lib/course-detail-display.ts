import {
  type CatalogNamed,
  catalogLocalizedNames,
} from "./catalog-list-display";

export function formatCatalogDetailMessage(
  template: string,
  values: Record<string, string>,
) {
  return Object.entries(values).reduce(
    (message, [key, value]) => message.replace(`{${key}}`, value),
    template,
  );
}

export function teacherNames(teachers: CatalogNamed[], locale?: string | null) {
  return catalogLocalizedNames(teachers, locale);
}
