export const CATALOG_MAX_PAGE = 100;
/** Shared bound for the `ids` / `jwIds` catalog filters across transports. */
export const CATALOG_ID_LIST_MAX_ITEMS = 100;
export const CATALOG_MAX_ID = 2_147_483_647;
export const CATALOG_SEARCH_MIN_LENGTH = 2;
export const CATALOG_SEARCH_MAX_LENGTH = 200;
export const CATALOG_TEXT_FILTER_MAX_LENGTH = 128;
/** Documented maximum, and the default, for a section's schedule list. */
export const SECTION_SCHEDULE_MAX_LIMIT = 200;

export type CatalogListPath =
  | "/catalog/courses"
  | "/catalog/sections"
  | "/catalog/teachers";

const COURSE_ID_KEYS = [
  "categoryId",
  "classTypeId",
  "educationLevelId",
] as const;
const SECTION_ID_KEYS = [
  "campusId",
  "categoryId",
  "classTypeId",
  "departmentId",
  "educationLevelId",
  "semesterId",
] as const;
const SECTION_TEXT_KEYS = [
  "courseName",
  "courseCode",
  "sectionCode",
  "teacher",
] as const;
const TEACHER_ID_KEYS = ["departmentId", "teacherTitleId"] as const;
const NAME_TEXT_KEYS = ["name", "code"] as const;
const NUMERIC_OPERATORS = new Set([
  "eq",
  "ne",
  "gt",
  "gte",
  "lt",
  "lte",
  "between",
]);
const SECTION_NUMERIC_KEYS = [
  "credits",
  "stdCount",
  "limitCount",
  "teacherCount",
] as const;
const numericKeys = (fields: readonly string[]) =>
  fields.flatMap((field) => [field, `${field}Op`, `${field}Max`]);
const SECTION_SORT_VALUES = new Set([
  "campus",
  "capacity",
  "code",
  "course",
  "credits",
  "semester",
  "teacher",
]);

const CATALOG_ALLOWED_QUERY_KEYS: Record<
  CatalogListPath,
  ReadonlySet<string>
> = {
  "/catalog/courses": new Set([
    ...COURSE_ID_KEYS,
    ...NAME_TEXT_KEYS,
    "page",
    "search",
  ]),
  "/catalog/sections": new Set([
    ...SECTION_ID_KEYS,
    ...SECTION_TEXT_KEYS,
    ...numericKeys(SECTION_NUMERIC_KEYS),
    "order",
    "page",
    "search",
    "sort",
  ]),
  "/catalog/teachers": new Set([
    ...TEACHER_ID_KEYS,
    ...NAME_TEXT_KEYS,
    "email",
    ...numericKeys(["sectionCount"]),
    "page",
    "search",
  ]),
};

const DECIMAL_INTEGER = /^\d+$/;
const DECIMAL_NUMBER = /^\d+(?:\.\d+)?$/;

export function isCatalogListPath(
  pathname: string,
): pathname is CatalogListPath {
  return Object.hasOwn(CATALOG_ALLOWED_QUERY_KEYS, pathname);
}

function positiveDecimal(value: string | null, maximum: number) {
  const trimmed = value?.trim();
  if (!trimmed || !DECIMAL_INTEGER.test(trimmed)) return undefined;

  const parsed = Number(trimmed);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > maximum) {
    return undefined;
  }
  return String(parsed);
}

function positiveDecimalList(value: string | null) {
  if (!value?.trim()) return undefined;
  const values = value.split(",");
  if (values.length > CATALOG_ID_LIST_MAX_ITEMS) return undefined;
  const parsed = values.map((item) => positiveDecimal(item, CATALOG_MAX_ID));
  if (parsed.some((item) => item === undefined)) return undefined;
  return [...new Set(parsed as string[])]
    .sort((a, b) => Number(a) - Number(b))
    .join(",");
}

function normalizeNumericFilter(
  result: URLSearchParams,
  input: URLSearchParams,
  field: string,
) {
  const value = decimalNumber(input.get(field));
  const operator = input.get(`${field}Op`)?.trim() || "eq";
  const validValue = (candidate: string | undefined) =>
    candidate !== undefined &&
    Number(candidate) <= CATALOG_MAX_ID &&
    (field === "credits" || Number.isInteger(Number(candidate)));
  if (!validValue(value) || !NUMERIC_OPERATORS.has(operator)) return;
  if (operator === "between") {
    const maximum = decimalNumber(input.get(`${field}Max`));
    if (!validValue(maximum) || Number(maximum) < Number(value)) return;
    result.set(`${field}Max`, maximum as string);
  }
  result.set(field, value as string);
  if (operator !== "eq") result.set(`${field}Op`, operator);
}

/** Flat, canonical Web form values; independent from transport scalar schemas. */
export function catalogTableFilterValues(
  pathname: CatalogListPath,
  params: URLSearchParams,
) {
  return Object.fromEntries(
    [...normalizeCatalogListQuery(pathname, params)].filter(
      ([key]) => key !== "page",
    ),
  );
}

function boundedPage(value: string | null) {
  const trimmed = value?.trim();
  if (!trimmed || !DECIMAL_INTEGER.test(trimmed)) return undefined;

  const parsed = Number(trimmed);
  if (!Number.isSafeInteger(parsed) || parsed < 1) return undefined;
  return String(Math.min(parsed, CATALOG_MAX_PAGE));
}

function boundedText(value: string | null, maximumLength: number) {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, maximumLength);
}

function boundedSearch(value: string | null) {
  const search = boundedText(value, CATALOG_SEARCH_MAX_LENGTH);
  return search && search.length >= CATALOG_SEARCH_MIN_LENGTH
    ? search
    : undefined;
}

function decimalNumber(value: string | null) {
  const trimmed = value?.trim();
  if (!trimmed || !DECIMAL_NUMBER.test(trimmed)) return undefined;

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return undefined;
  const canonical = String(parsed);
  return DECIMAL_NUMBER.test(canonical) ? canonical : undefined;
}

function setNormalized(
  result: URLSearchParams,
  key: string,
  value: string | undefined,
) {
  if (value !== undefined) result.set(key, value);
}

export function normalizeCatalogListQuery(
  pathname: CatalogListPath,
  searchParams: URLSearchParams,
) {
  const normalized = new URLSearchParams();
  const page = boundedPage(searchParams.get("page"));
  if (page !== "1") setNormalized(normalized, "page", page);
  setNormalized(
    normalized,
    "search",
    boundedSearch(searchParams.get("search")),
  );

  const idKeys =
    pathname === "/catalog/courses"
      ? COURSE_ID_KEYS
      : pathname === "/catalog/teachers"
        ? TEACHER_ID_KEYS
        : SECTION_ID_KEYS;
  for (const key of idKeys) {
    setNormalized(normalized, key, positiveDecimalList(searchParams.get(key)));
  }
  const textKeys =
    pathname === "/catalog/sections"
      ? SECTION_TEXT_KEYS
      : pathname === "/catalog/teachers"
        ? [...NAME_TEXT_KEYS, "email"]
        : NAME_TEXT_KEYS;
  for (const key of textKeys) {
    setNormalized(
      normalized,
      key,
      boundedText(searchParams.get(key), CATALOG_TEXT_FILTER_MAX_LENGTH),
    );
  }
  for (const key of pathname === "/catalog/sections"
    ? SECTION_NUMERIC_KEYS
    : pathname === "/catalog/teachers"
      ? ["sectionCount"]
      : []) {
    normalizeNumericFilter(normalized, searchParams, key);
  }
  if (pathname === "/catalog/sections") {
    const requestedSort = searchParams.get("sort")?.trim().toLowerCase();
    if (requestedSort && SECTION_SORT_VALUES.has(requestedSort)) {
      normalized.set("sort", requestedSort);
      normalized.set(
        "order",
        searchParams.get("order")?.trim() === "desc" ? "desc" : "asc",
      );
    }
  }

  normalized.sort();
  return normalized;
}

export function isCacheableCatalogListQuery(
  pathname: CatalogListPath,
  searchParams: URLSearchParams,
) {
  const allowedKeys = CATALOG_ALLOWED_QUERY_KEYS[pathname];
  const seen = new Set<string>();
  const received = new URLSearchParams();
  for (const [key, value] of searchParams) {
    if (!allowedKeys.has(key) || seen.has(key)) return false;
    seen.add(key);
    if (value !== "") received.set(key, value);
  }

  received.sort();
  return (
    received.toString() ===
    normalizeCatalogListQuery(pathname, searchParams).toString()
  );
}

export function resolveCatalogListPublicSsrMode(url: URL) {
  if (!isCatalogListPath(url.pathname)) return undefined;
  return isCacheableCatalogListQuery(url.pathname, url.searchParams)
    ? ("page" as const)
    : null;
}

/** Build a catalog list URL for `targetPage`, preserving current filter params. */
export function catalogListPageHref(url: URL, targetPage: number) {
  const params = new URLSearchParams(url.searchParams);
  const page = boundedPage(String(targetPage));
  if (page && page !== "1") {
    params.set("page", page);
  } else {
    params.delete("page");
  }

  const query = params.toString();
  return query ? `${url.pathname}?${query}` : url.pathname;
}
