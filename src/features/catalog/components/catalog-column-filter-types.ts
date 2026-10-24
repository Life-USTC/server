import type { TableFilterField, TableFilterLabels } from "@/lib/table-filters";

export type CatalogColumnField = TableFilterField;
export type CatalogColumnFilterProps = {
  label: string;
  fields?: TableFilterField[];
  values: Record<string, string>;
  onchange: (patch: Record<string, string>) => void;
  labels: TableFilterLabels;
  formId: string;
  align?: "start" | "end";
  sorting?: {
    key: string;
    label: string;
    ascending: string;
    descending: string;
    default: string;
  };
};
