import type { TableFilterField, TableFilterLabels } from "@/lib/table-filters";

export type CatalogColumnField = TableFilterField;
export type CatalogColumnFilterProps = {
  label: string;
  fields?: TableFilterField[];
  values: Record<string, string>;
  onchange: (patch: Record<string, string>) => void;
  labels: TableFilterLabels;
  formId: string;
  sorting?: {
    key: string;
    label: string;
    ascending: string;
    descending: string;
    default: string;
  };
};

export function catalogColumnFilters(
  fields: Record<string, TableFilterField>,
  defaults: Pick<
    CatalogColumnFilterProps,
    "values" | "onchange" | "labels" | "formId"
  >,
): Record<string, CatalogColumnFilterProps> {
  return Object.fromEntries(
    Object.entries(fields).map(([key, field]) => [
      key,
      { ...defaults, label: field.label, fields: [field] },
    ]),
  );
}
