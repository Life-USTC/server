import {
  classifyFeatureError,
  type FeatureOperation,
  type FeatureOperationResult,
  observeFeatureOperation,
} from "@/lib/metrics/feature-operation";

const TOOL_OPERATIONS: Readonly<Record<string, FeatureOperation>> = {
  catalog_course_search: { feature: "catalog.course", operation: "search" },
  catalog_course_get: { feature: "catalog.course", operation: "get" },
  catalog_section_search: { feature: "catalog.section", operation: "search" },
  catalog_section_match_preview: {
    feature: "catalog.section",
    operation: "match",
  },
  catalog_section_get: { feature: "catalog.section", operation: "get" },
  catalog_teacher_search: { feature: "catalog.teacher", operation: "search" },
  catalog_teacher_get: { feature: "catalog.teacher", operation: "get" },
  workspace_overview_get: { feature: "workspace.overview", operation: "get" },
  workspace_snapshot_get: { feature: "workspace.overview", operation: "get" },
  workspace_subscription_list: {
    feature: "workspace.subscription",
    operation: "list",
  },
  workspace_subscription_add: {
    feature: "workspace.subscription",
    operation: "create",
  },
  workspace_subscription_remove: {
    feature: "workspace.subscription",
    operation: "delete",
  },
  workspace_subscription_kind_update: {
    feature: "workspace.subscription",
    operation: "update",
  },
  workspace_subscription_import: {
    feature: "workspace.subscription",
    operation: "import",
  },
  workspace_homework_list: { feature: "workspace.homework", operation: "list" },
  workspace_homework_completion_set: {
    feature: "workspace.homework",
    operation: "set_completion",
  },
  community_section_homework_list: {
    feature: "community.section-homework",
    operation: "list",
  },
  community_section_homework_create: {
    feature: "community.section-homework",
    operation: "create",
  },
  community_section_homework_update: {
    feature: "community.section-homework",
    operation: "update",
  },
  community_section_homework_delete: {
    feature: "community.section-homework",
    operation: "delete",
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function classifyMcpFeatureResult(
  value: unknown,
): FeatureOperationResult {
  if (!isRecord(value) || value.isError === true)
    return { outcome: "unknown", errorClass: "unknown" };
  const payload = value.structuredContent;
  if (!isRecord(payload)) return { outcome: "unknown", errorClass: "unknown" };
  if (payload.found === false)
    return { outcome: "rejected", errorClass: "not_found" };
  if (payload.success === false)
    return { outcome: "unknown", errorClass: "unknown" };
  // An import with unmatched codes is not a completely successful batch.
  if (
    Array.isArray(payload.unmatchedCodes) &&
    payload.unmatchedCodes.length > 0
  )
    return { outcome: "unknown", errorClass: "unknown" };
  return { outcome: "success", errorClass: "none" };
}

export function observeMcpFeature<T>(
  name: string,
  args: unknown,
  extra: unknown,
  run: () => T | Promise<T>,
  outputValidationFailed?: () => boolean,
) {
  const mapped = TOOL_OPERATIONS[name];
  if (!mapped) return run();
  const operation =
    mapped.operation === "search" &&
    !(isRecord(args) && typeof args.search === "string" && args.search.trim())
      ? "list"
      : mapped.operation;
  return observeFeatureOperation(
    {
      ...mapped,
      operation,
      protocol: "mcp",
      surface: "mcp",
      userId:
        isRecord(extra) &&
        isRecord(extra.authInfo) &&
        isRecord(extra.authInfo.extra) &&
        typeof extra.authInfo.extra.userId === "string"
          ? extra.authInfo.extra.userId
          : null,
      authMode:
        isRecord(extra) && isRecord(extra.authInfo) ? "oauth" : "anonymous",
    },
    run,
    classifyMcpFeatureResult,
    (error) =>
      outputValidationFailed?.()
        ? { outcome: "error", errorClass: "internal" }
        : classifyFeatureError(error),
  );
}
