export type CatalogColumnField = {
  name: string;
  label: string;
  options?: { label: string; value: string }[];
  type?: "text" | "number";
  min?: number;
  step?: number;
  description?: string;
};

export type CatalogColumnFilterProps = {
  action: string;
  label: string;
  fields?: CatalogColumnField[];
  filters: Record<string, string | null | undefined>;
  search: string;
  applyLabel: string;
  clearLabel: string;
  align?: "start" | "end";
  sorting?: {
    key: string;
    label: string;
    ascending: string;
    descending: string;
    default: string;
  };
};
