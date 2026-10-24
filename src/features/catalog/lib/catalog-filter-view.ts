import {
  type TableFilterField,
  type TableFilterLabels,
  tableFilterValues,
} from "@/lib/table-filters";
import { catalogHref } from "./catalog-list-display";

export function catalogFilterDraft(
  filters: Record<string, string | null | undefined>,
) {
  return Object.fromEntries(
    Object.entries(filters).map(([key, value]) => [key, value ?? ""]),
  );
}

export function catalogActiveFilters(
  path: string,
  filters: Record<string, string | null | undefined>,
  fields: TableFilterField[],
  labels: TableFilterLabels,
) {
  return fields.flatMap((field) => {
    const value = filters[field.name];
    if (!value) return [];
    let display = field.options
      ? tableFilterValues(value)
          .map(
            (selected) =>
              field.options?.find((option) => option.value === selected)
                ?.label ?? selected,
          )
          .join(", ")
      : value;
    if (field.type && field.type !== "text") {
      const operator = filters[`${field.name}Op`] || "eq";
      display = `${labels.operators[operator as keyof typeof labels.operators] ?? operator} ${value}${operator === "between" ? ` – ${filters[`${field.name}Max`] ?? ""}` : ""}`;
    }
    return [
      {
        href: catalogHref(path, {
          ...filters,
          page: "",
          [field.name]: "",
          [`${field.name}Op`]: "",
          [`${field.name}Max`]: "",
        }),
        label: `${field.label}: ${display}`,
      },
    ];
  });
}
