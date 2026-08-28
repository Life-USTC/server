import type { AppLocale } from "@/i18n/config";
import { cachedCatalogRuntimeData } from "@/lib/catalog-runtime-cache";
import type { PublicRuntimeCacheAnalyticsNamespace } from "@/lib/metrics/analytics-engine";
import { getCanonicalOrigin } from "@/lib/site-url";

type CatalogListKind = "courses" | "schedules" | "sections" | "teachers";

function normalizeCacheKeyValue(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) {
    return value
      .map(normalizeCacheKeyValue)
      .sort((left, right) =>
        JSON.stringify(left).localeCompare(JSON.stringify(right)),
      );
  }
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, normalizeCacheKeyValue(entry)]),
  );
}

export function catalogListReadCacheKey(input: {
  filters: Readonly<Record<string, unknown>>;
  pagination: { page: number; pageSize: number };
  shape: string;
}) {
  return JSON.stringify(normalizeCacheKeyValue(input));
}

export function catalogListReadCacheNamespace(
  kind: CatalogListKind,
  locale: AppLocale,
): PublicRuntimeCacheAnalyticsNamespace {
  return `catalog:${kind}-list:${locale}`;
}

export function cachedCatalogListRead<T>(input: {
  filters: Readonly<Record<string, unknown>>;
  kind: CatalogListKind;
  load: () => Promise<T>;
  locale: AppLocale;
  pagination: { page: number; pageSize: number };
  shape: string;
}) {
  const namespace = catalogListReadCacheNamespace(input.kind, input.locale);
  return cachedCatalogRuntimeData(
    namespace,
    catalogListReadCacheKey({
      filters: input.filters,
      pagination: input.pagination,
      shape: input.shape,
    }),
    getCanonicalOrigin(),
    input.load,
  );
}
