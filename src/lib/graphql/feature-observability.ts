import type { GraphQLResolveInfo } from "graphql";
import { getCloudflareRequestContext } from "@/lib/adapters/cloudflare-runtime";
import {
  type ExperienceAuth,
  type ExperienceError,
  type ExperienceFeature,
  type ExperienceOperation,
  type ExperienceSurface,
  type FeatureOperationContext,
  type FeatureOperationResult,
  observeFeatureOperation,
} from "@/lib/metrics/feature-operation";
import type { GraphqlPrincipal } from "./auth";

type GraphqlResolver = (
  this: unknown,
  parent: unknown,
  args: unknown,
  context: unknown,
  info: GraphQLResolveInfo,
) => unknown;

type OperationSelector =
  | ExperienceOperation
  | ((args: unknown) => ExperienceOperation);

export type GraphqlFeatureResolverMapping = {
  feature: ExperienceFeature;
  operation: OperationSelector;
  classify?: (value: unknown) => FeatureOperationResult;
};

export const GRAPHQL_FEATURE_RESOLVER_MAPPINGS = {
  Catalog: {
    courses: {
      feature: "catalog.course",
      operation: catalogListOperation,
    },
    course: {
      feature: "catalog.course",
      operation: "get",
      classify: classifyCatalogDetail,
    },
    sections: {
      feature: "catalog.section",
      operation: catalogListOperation,
    },
    section: {
      feature: "catalog.section",
      operation: "get",
      classify: classifyCatalogDetail,
    },
    teachers: {
      feature: "catalog.teacher",
      operation: catalogListOperation,
    },
    teacher: {
      feature: "catalog.teacher",
      operation: "get",
      classify: classifyCatalogDetail,
    },
  },
  Workspace: {
    overview: { feature: "workspace.overview", operation: "get" },
    subscribedSections: {
      feature: "workspace.subscription",
      operation: "list",
    },
    homeworks: { feature: "workspace.homework", operation: "list" },
  },
  Mutation: {
    homeworkCreate: {
      feature: "community.section-homework",
      operation: "create",
    },
    homeworkUpdate: {
      feature: "community.section-homework",
      operation: "update",
    },
    homeworkDelete: {
      feature: "community.section-homework",
      operation: "delete",
    },
    homeworkCompletionSet: {
      feature: "workspace.homework",
      operation: "set_completion",
    },
    homeworkCompletionsSet: {
      feature: "workspace.homework",
      operation: "batch",
      classify: classifyHomeworkCompletionBatch,
    },
    subscriptionAdd: {
      feature: "workspace.subscription",
      operation: "create",
    },
    subscriptionRemove: {
      feature: "workspace.subscription",
      operation: "delete",
    },
    subscriptionKindUpdate: {
      feature: "workspace.subscription",
      operation: "update",
    },
    subscriptionsImport: {
      feature: "workspace.subscription",
      operation: "import",
      classify: classifySubscriptionImport,
    },
  },
} as const satisfies Record<
  string,
  Record<string, GraphqlFeatureResolverMapping>
>;

function classifyCatalogDetail(value: unknown): FeatureOperationResult {
  return value == null
    ? { outcome: "rejected", errorClass: "not_found" }
    : { outcome: "success", errorClass: "none" };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function hasSearchArgument(args: unknown) {
  if (!isRecord(args) || !isRecord(args.filter)) return false;
  return (
    typeof args.filter.search === "string" &&
    args.filter.search.trim().length > 0
  );
}

function catalogListOperation(args: unknown): "list" | "search" {
  return hasSearchArgument(args) ? "search" : "list";
}

function principalFromContext(context: unknown): GraphqlPrincipal | undefined {
  if (!isRecord(context) || !isRecord(context.principal)) return undefined;
  const principal = context.principal;
  if (principal.kind === "anonymous") return { kind: "anonymous" };
  if (principal.kind === "session" || principal.kind === "oauth") {
    return principal as unknown as GraphqlPrincipal;
  }
  return undefined;
}

function requestIdFromRuntime() {
  try {
    return getCloudflareRequestContext()?.requestId;
  } catch {
    return undefined;
  }
}

function featureContext(
  feature: ExperienceFeature,
  operation: ExperienceOperation,
  context: unknown,
): FeatureOperationContext {
  const principal = principalFromContext(context);
  const authMode: ExperienceAuth = principal?.kind ?? "unknown";
  const surface: ExperienceSurface =
    principal?.kind === "oauth" && principal.channel === "mcp"
      ? "mcp"
      : "unknown";
  const requestId = requestIdFromRuntime();
  return {
    authMode,
    userId:
      principal && principal.kind !== "anonymous" ? principal.userId : null,
    feature,
    operation,
    protocol: "graphql",
    requestId,
    surface,
  };
}

const SUCCESS: FeatureOperationResult = {
  outcome: "success",
  errorClass: "none",
};
const UNKNOWN: FeatureOperationResult = {
  outcome: "unknown",
  errorClass: "unknown",
};

function errorClassForBatchCode(code: unknown): ExperienceError | undefined {
  if (typeof code !== "string") return undefined;
  switch (code.toLowerCase()) {
    case "invalid_input":
      return "invalid_input";
    case "unauthorized":
      return "unauthorized";
    case "forbidden":
    case "locked":
    case "deleted":
    case "suspended":
      return "forbidden";
    case "not_found":
      return "not_found";
    case "conflict":
      return "conflict";
    case "rate_limited":
      return "rate_limited";
    case "dependency":
      return "dependency";
    case "internal":
      return "internal";
    default:
      return undefined;
  }
}

function classifyBatchResults(value: unknown): FeatureOperationResult {
  if (!isRecord(value) || !Array.isArray(value.results)) return UNKNOWN;
  if (value.results.length === 0) return SUCCESS;

  const results = value.results;
  const successes: boolean[] = [];
  const errors: ExperienceError[] = [];
  for (const result of results) {
    if (!isRecord(result) || typeof result.success !== "boolean") {
      return UNKNOWN;
    }
    successes.push(result.success);
    if (!result.success) {
      if (!isRecord(result.error)) return UNKNOWN;
      const errorClass = errorClassForBatchCode(result.error.code);
      if (!errorClass) return UNKNOWN;
      errors.push(errorClass);
    }
  }

  if (errors.length === 0) return SUCCESS;
  if (successes.some(Boolean)) return UNKNOWN;
  const firstError = errors[0];
  if (!errors.every((errorClass) => errorClass === firstError)) return UNKNOWN;
  return {
    outcome:
      firstError === "dependency" || firstError === "internal"
        ? "error"
        : "rejected",
    errorClass: firstError,
  };
}

function classifyHomeworkCompletionBatch(
  value: unknown,
): FeatureOperationResult {
  return classifyBatchResults(value);
}

function classifySubscriptionImport(value: unknown): FeatureOperationResult {
  if (
    !isRecord(value) ||
    !Array.isArray(value.matchedCodes) ||
    !Array.isArray(value.unmatchedCodes)
  ) {
    return UNKNOWN;
  }
  if (value.unmatchedCodes.length === 0) return SUCCESS;
  if (value.matchedCodes.length === 0) {
    return { outcome: "rejected", errorClass: "not_found" };
  }
  return UNKNOWN;
}

export function observeGraphqlResolver<T extends GraphqlResolver>(
  resolver: T,
  mapping: GraphqlFeatureResolverMapping,
): T {
  return function observedGraphqlResolver(
    this: unknown,
    parent: unknown,
    args: unknown,
    context: unknown,
    info: GraphQLResolveInfo,
  ) {
    const operation =
      typeof mapping.operation === "function"
        ? mapping.operation(args)
        : mapping.operation;
    return observeFeatureOperation(
      featureContext(mapping.feature, operation, context),
      () => resolver.call(this, parent, args, context, info),
      mapping.classify,
    );
  } as T;
}

export function observeGraphqlResolverMap<T extends Record<string, unknown>>(
  resolvers: T,
  mappings: Readonly<Record<string, GraphqlFeatureResolverMapping>>,
): T {
  const observed: Record<string, unknown> = { ...resolvers };
  for (const [fieldName, mapping] of Object.entries(mappings)) {
    const resolver = resolvers[fieldName];
    if (typeof resolver !== "function") continue;
    observed[fieldName] = observeGraphqlResolver(
      resolver as GraphqlResolver,
      mapping,
    );
  }
  return observed as T;
}
