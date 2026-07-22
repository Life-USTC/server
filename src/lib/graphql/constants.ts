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
  page: 10_000,
  pageSize: 100,
  requestBatch: 1,
  searchChars: 200,
  teacherCodeChars: 80,
  timeoutMs: 5000,
  tokens: 1000,
  topLevelFields: 10,
  versionKeyChars: 120,
} as const;

export const GRAPHQL_SCHEMA_RESOURCE_URI = "life-ustc://graphql/schema";
export const GRAPHQL_OPERATIONS_RESOURCE_URI = "life-ustc://graphql/operations";

export function isWithinGraphqlBodyByteLimit(value: string) {
  return new TextEncoder().encode(value).byteLength <= GRAPHQL_LIMITS.bodyBytes;
}
