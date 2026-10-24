import { parseDateInput } from "@/lib/time/parse-date-input";
import { addShanghaiTime } from "@/lib/time/shanghai-format";

type FilterValues = Record<string, string | null | undefined>;
type Comparison<T> = {
  equals?: T;
  not?: T | Comparison<T>;
  gt?: T;
  gte?: T;
  lt?: T;
  lte?: T;
};

/** Undefined means no condition; an impossible range keeps malformed filters empty. */
export function numberTableFilter(
  values: FilterValues,
  field: string,
): Comparison<number> | undefined {
  const raw = values[field]?.trim();
  if (!raw) return undefined;
  const value = Number(raw);
  const invalid = { gt: 0, lt: 0 };
  if (!Number.isFinite(value)) return invalid;
  switch (values[`${field}Op`] || "eq") {
    case "eq":
      return { equals: value };
    case "ne":
      return { not: value };
    case "gt":
      return { gt: value };
    case "gte":
      return { gte: value };
    case "lt":
      return { lt: value };
    case "lte":
      return { lte: value };
    case "between": {
      const upper = values[`${field}Max`]?.trim();
      const maximum = Number(upper);
      return upper && Number.isFinite(maximum) && maximum >= value
        ? { gte: value, lte: maximum }
        : invalid;
    }
    default:
      return invalid;
  }
}

export function dateTableFilter(
  values: FilterValues,
  field: string,
): Comparison<Date> | undefined {
  const raw = values[field]?.trim();
  if (!raw) return undefined;
  const invalid = { gt: new Date(0), lt: new Date(0) };
  const value = /^\d{4}-\d{2}-\d{2}$/.test(raw)
    ? parseDateInput(`${raw}T00:00:00`)
    : undefined;
  if (!value) return invalid;
  const next = addShanghaiTime(value, 1, "day");
  switch (values[`${field}Op`] || "eq") {
    case "eq":
      return { gte: value, lt: next };
    case "ne":
      return { not: { gte: value, lt: next } };
    case "gt":
      return { gte: next };
    case "gte":
      return { gte: value };
    case "lt":
      return { lt: value };
    case "lte":
      return { lt: next };
    case "between": {
      const upper = values[`${field}Max`]?.trim();
      const maximum =
        upper && /^\d{4}-\d{2}-\d{2}$/.test(upper)
          ? parseDateInput(`${upper}T00:00:00`)
          : undefined;
      return maximum && maximum >= value
        ? { gte: value, lt: addShanghaiTime(maximum, 1, "day") }
        : invalid;
    }
    default:
      return invalid;
  }
}

export function tableFilterParams(url: URL, fields: readonly string[]) {
  return Object.fromEntries(
    fields.map((field) => [field, url.searchParams.get(field)?.trim() ?? ""]),
  );
}

export function tableFilterPageHref(
  pathname: string,
  values: FilterValues,
  page?: number,
) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values))
    if (value?.trim()) params.set(key, value.trim());
  params.delete("page");
  if (page && page > 1) params.set("page", String(page));
  return `${pathname}${params.size ? `?${params}` : ""}`;
}
