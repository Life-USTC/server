import {
  type TableFilterField,
  type TableFilterLabels,
  tableFilterValues,
} from "@/lib/table-filters";

/** Removing one applied condition must not discard other unsubmitted drafts. */
export function withoutTaskFilter(
  values: Record<string, string>,
  name: string,
) {
  return Object.fromEntries(
    Object.entries(values).filter(
      ([key]) => ![name, `${name}Op`, `${name}Max`].includes(key),
    ),
  );
}

export function taskFilterSummary(
  field: TableFilterField,
  values: Record<string, string>,
  labels: TableFilterLabels,
) {
  const value = values[field.name]?.trim();
  if (!value) return null;
  if (field.options) {
    return tableFilterValues(value)
      .map(
        (selected) =>
          field.options?.find((option) => option.value === selected)?.label ??
          selected,
      )
      .join(", ");
  }
  if (!field.type || field.type === "text") return value;
  const operator = values[`${field.name}Op`] || "eq";
  const label =
    labels.operators[operator as keyof TableFilterLabels["operators"]] ??
    operator;
  return `${label} ${value}${operator === "between" ? ` – ${values[`${field.name}Max`] || labels.maximum}` : ""}`;
}
