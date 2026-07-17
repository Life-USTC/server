export const GRAPHQL_ENDPOINT = "/api/graphql";

export const GRAPHQL_LIMITS = {
  aliases: 15,
  bodyBytes: 64 * 1024,
  cost: 5000,
  depth: 8,
  directives: 10,
  pageSize: 100,
  requestBatch: 1,
  timeoutMs: 5000,
  tokens: 1000,
  topLevelFields: 10,
} as const;

export const GRAPHQL_SCHEMA_RESOURCE_URI = "life-ustc://graphql/schema";
export const GRAPHQL_OPERATIONS_RESOURCE_URI = "life-ustc://graphql/operations";
