export type NumericFilterOperator =
  | "eq"
  | "ne"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "between";

export type TableFilterField = {
  name: string;
  label: string;
  type?: "text" | "number" | "date" | "time";
  options?: { label: string; value: string }[];
  min?: number;
  step?: number | "any";
  description?: string;
};

export type TableFilterLabels = {
  any: string;
  operator: string;
  value: string;
  maximum: string;
  selected: string;
  yes: string;
  no: string;
  operators: Record<NumericFilterOperator, string>;
};

export function tableFilterValues(value: string | null | undefined) {
  return [
    ...new Set(
      (value ?? "")
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean),
    ),
  ];
}

export function matchTableFilter(
  value: string | number | null | undefined | readonly (string | number)[],
  field: TableFilterField,
  values: Record<string, string>,
): boolean {
  const requested = values[field.name]?.trim();
  if (!requested) return true;
  if (Array.isArray(value)) {
    return value.some((item) => matchTableFilter(item, field, values));
  }
  if (value == null || value === "") return false;
  if (field.options) {
    return tableFilterValues(requested).includes(String(value));
  }
  if (!field.type || field.type === "text") {
    return String(value)
      .toLocaleLowerCase()
      .includes(requested.toLocaleLowerCase());
  }
  const actual = field.type === "number" ? Number(value) : String(value);
  const expected = field.type === "number" ? Number(requested) : requested;
  if (
    typeof actual === "number" &&
    (!Number.isFinite(actual) || !Number.isFinite(expected))
  )
    return false;
  const operator = values[`${field.name}Op`] || "eq";
  switch (operator) {
    case "eq":
      return actual === expected;
    case "ne":
      return actual !== expected;
    case "gt":
      return actual > expected;
    case "gte":
      return actual >= expected;
    case "lt":
      return actual < expected;
    case "lte":
      return actual <= expected;
    case "between": {
      const upper = values[`${field.name}Max`]?.trim();
      if (!upper) return false;
      const maximum = field.type === "number" ? Number(upper) : upper;
      return actual >= expected && actual <= maximum;
    }
    default:
      return false;
  }
}
