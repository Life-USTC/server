import { BUS_VERSION_KEY_MAX_LENGTH } from "@/features/bus/lib/bus-version-key";
import {
  CATALOG_MAX_PAGE,
  CATALOG_SEARCH_MAX_LENGTH,
  CATALOG_SEARCH_MIN_LENGTH,
} from "@/features/catalog/lib/catalog-list-query";

export const GRAPHQL_ENDPOINT = "/api/graphql";

export const GRAPHQL_LIMITS = {
  aliases: 15,
  bodyBytes: 64 * 1024,
  busAlternateRoutes: 20,
  busCampuses: 32,
  busRouteStops: 16,
  busStopTimes: 16,
  cost: 5000,
  defaultPageSize: 20,
  depth: 8,
  directives: 10,
  idList: 100,
  page: CATALOG_MAX_PAGE,
  pageSize: 100,
  requestBatch: 1,
  searchChars: CATALOG_SEARCH_MAX_LENGTH,
  searchMinChars: CATALOG_SEARCH_MIN_LENGTH,
  teacherCodeChars: 80,
  timeoutMs: 5000,
  tokens: 1000,
  topLevelFields: 10,
  versionKeyChars: BUS_VERSION_KEY_MAX_LENGTH,
} as const;

export const GRAPHQL_SCHEMA_RESOURCE_URI = "life-ustc://graphql/schema";
export const GRAPHQL_OPERATIONS_RESOURCE_URI = "life-ustc://graphql/operations";

export function isWithinGraphqlBodyByteLimit(value: string) {
  return new TextEncoder().encode(value).byteLength <= GRAPHQL_LIMITS.bodyBytes;
}
