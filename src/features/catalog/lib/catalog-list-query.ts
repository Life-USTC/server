export const CATALOG_MAX_PAGE = 5_000;
export const CATALOG_MAX_ID = 2_147_483_647;
export const CATALOG_SEARCH_MAX_LENGTH = 256;
export const CATALOG_TEXT_FILTER_MAX_LENGTH = 128;

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
const SECTION_TEXT_KEYS = ["courseCode", "sectionCode", "teacher"] as const;
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
  "/catalog/courses": new Set([...COURSE_ID_KEYS, "page", "search"]),
  "/catalog/sections": new Set([
    ...SECTION_ID_KEYS,
    ...SECTION_TEXT_KEYS,
    "credits",
    "order",
    "page",
    "search",
    "sort",
  ]),
  "/catalog/teachers": new Set(["departmentId", "page", "search"]),
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
    boundedText(searchParams.get("search"), CATALOG_SEARCH_MAX_LENGTH),
  );

  if (pathname === "/catalog/courses") {
    for (const key of COURSE_ID_KEYS) {
      setNormalized(
        normalized,
        key,
        positiveDecimal(searchParams.get(key), CATALOG_MAX_ID),
      );
    }
  } else if (pathname === "/catalog/teachers") {
    setNormalized(
      normalized,
      "departmentId",
      positiveDecimal(searchParams.get("departmentId"), CATALOG_MAX_ID),
    );
  } else {
    for (const key of SECTION_ID_KEYS) {
      setNormalized(
        normalized,
        key,
        positiveDecimal(searchParams.get(key), CATALOG_MAX_ID),
      );
    }
    for (const key of SECTION_TEXT_KEYS) {
      setNormalized(
        normalized,
        key,
        boundedText(searchParams.get(key), CATALOG_TEXT_FILTER_MAX_LENGTH),
      );
    }
    setNormalized(
      normalized,
      "credits",
      decimalNumber(searchParams.get("credits")),
    );

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
