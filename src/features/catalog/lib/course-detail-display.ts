import {
  type CatalogNamed,
  catalogLocalizedNames,
  catalogPrimaryName,
  catalogSecondaryName,
} from "./catalog-list-display";

export function courseDetailPrimaryName(item?: CatalogNamed | null) {
  return catalogPrimaryName(item);
}

export function courseDetailSecondaryName(item?: CatalogNamed | null) {
  return catalogSecondaryName(item);
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

export function teacherNames(teachers: CatalogNamed[], locale?: string | null) {
  return catalogLocalizedNames(teachers, locale);
}
