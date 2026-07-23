import {
  type RestFeature,
  restReadScope,
  restWriteScope,
} from "@/lib/oauth/constants";

type ToolScopeRequirement = {
  action: "read" | "write";
  feature: RestFeature;
};

const BATCH_WRITE_TOOLS = new Set(["workspace_subscription_import"]);

/**
 * Maps every registered MCP tool name to the feature action scope(s) it needs.
 *
 * Registered tools must be present in this map; server startup asserts that
 * registration, scope, and output-schema metadata stay aligned. Unknown RPC
 * tool names still fall back to the generic MCP request scope before the SDK
 * returns its tool-not-found response.
 */
const TOOL_SCOPE_MAP: Record<string, ToolScopeRequirement[]> = {
  // Exact scopes vary by selected fields and are enforced by GraphQL resolvers.
  graphql_operation_run: [],

  // Profile
  account_profile_get: [{ feature: "me", action: "read" }],
  community_user_get: [{ feature: "me", action: "read" }],

  // Todos
  workspace_todo_list: [{ feature: "todo", action: "read" }],
  workspace_todo_create: [{ feature: "todo", action: "write" }],
  workspace_todo_update: [{ feature: "todo", action: "write" }],
  workspace_todo_delete: [{ feature: "todo", action: "write" }],

  // Homeworks
  workspace_homework_list: [{ feature: "homework", action: "read" }],
  workspace_homework_completion_set: [{ feature: "homework", action: "write" }],
  community_section_homework_list: [{ feature: "homework", action: "read" }],
  community_section_homework_create: [{ feature: "homework", action: "write" }],
  community_section_homework_update: [{ feature: "homework", action: "write" }],
  community_section_homework_delete: [{ feature: "homework", action: "write" }],

  // Section subscriptions
  workspace_calendar_feed_get: [{ feature: "subscription", action: "read" }],
  workspace_subscription_list: [{ feature: "subscription", action: "read" }],
  workspace_subscription_add: [{ feature: "subscription", action: "write" }],
  workspace_subscription_remove: [{ feature: "subscription", action: "write" }],
  workspace_subscription_import: [{ feature: "subscription", action: "write" }],
  catalog_section_calendar_feed_get: [
    { feature: "subscription", action: "read" },
  ],

  // Calendar
  workspace_calendar_event_list: [{ feature: "schedule", action: "read" }],
  workspace_calendar_timeline_get: [
    { feature: "schedule", action: "read" },
    { feature: "dashboard", action: "read" },
  ],

  // Comments
  community_comment_list: [{ feature: "comment", action: "read" }],
  community_comment_get: [{ feature: "comment", action: "read" }],
  community_comment_create: [{ feature: "comment", action: "write" }],
  community_comment_update: [{ feature: "comment", action: "write" }],
  community_comment_delete: [{ feature: "comment", action: "write" }],
  community_comment_reaction_add: [{ feature: "comment", action: "write" }],
  community_comment_reaction_remove: [{ feature: "comment", action: "write" }],

  // Descriptions
  community_description_get: [{ feature: "description", action: "read" }],
  community_description_set: [{ feature: "description", action: "write" }],

  // Uploads
  workspace_upload_list: [{ feature: "upload", action: "read" }],
  workspace_upload_rename: [{ feature: "upload", action: "write" }],
  workspace_upload_delete: [{ feature: "upload", action: "write" }],

  // Dashboard / overview
  workspace_snapshot_get: [{ feature: "dashboard", action: "read" }],
  workspace_link_list: [{ feature: "dashboard", action: "read" }],
  workspace_link_pin_set: [{ feature: "dashboard", action: "write" }],
  workspace_deadline_list: [{ feature: "dashboard", action: "read" }],
  workspace_overview_get: [{ feature: "dashboard", action: "read" }],
  workspace_schedule_next: [
    { feature: "dashboard", action: "read" },
    { feature: "schedule", action: "read" },
  ],

  // Bus
  catalog_bus_timetable_get: [{ feature: "bus", action: "read" }],
  catalog_bus_route_list: [{ feature: "bus", action: "read" }],
  catalog_bus_route_get: [{ feature: "bus", action: "read" }],
  workspace_bus_preferences_get: [{ feature: "bus", action: "read" }],
  workspace_bus_preferences_set: [{ feature: "bus", action: "write" }],
  catalog_bus_route_search: [{ feature: "bus", action: "read" }],
  catalog_bus_departure_next: [{ feature: "bus", action: "read" }],

  // Course catalog
  catalog_course_search: [{ feature: "course", action: "read" }],
  catalog_course_get: [{ feature: "course", action: "read" }],
  catalog_semester_list: [{ feature: "course", action: "read" }],
  catalog_semester_current: [{ feature: "course", action: "read" }],

  // Sections
  catalog_section_get: [{ feature: "section", action: "read" }],
  catalog_section_search: [{ feature: "section", action: "read" }],
  catalog_section_match_preview: [{ feature: "section", action: "read" }],

  // Teachers
  catalog_teacher_search: [{ feature: "teacher", action: "read" }],
  catalog_teacher_get: [{ feature: "teacher", action: "read" }],

  // Schedules
  catalog_schedule_list: [{ feature: "schedule", action: "read" }],
  catalog_section_schedule_list: [{ feature: "schedule", action: "read" }],
  workspace_schedule_list: [{ feature: "schedule", action: "read" }],

  // Exams
  catalog_section_exam_list: [{ feature: "exam", action: "read" }],
  workspace_exam_list: [{ feature: "exam", action: "read" }],
};

export function hasExplicitMcpToolScopes(name: string): boolean {
  return Object.hasOwn(TOOL_SCOPE_MAP, name);
}

export function getExplicitMcpToolScopeNames(): string[] {
  return Object.keys(TOOL_SCOPE_MAP);
}

/**
 * Returns the canonical OAuth scope strings required for the given tool name(s).
 *
 * - A single tool name returns the scopes for that tool.
 * - An array of tool names returns the union of their required scopes.
 * - An unknown/missing tool name contributes no additional scope requirement,
 *   falling back to the generic MCP scope check.
 */
export function getRequiredMcpScopes(
  toolName: string | string[] | undefined,
): string[] {
  const names =
    typeof toolName === "string"
      ? [toolName]
      : Array.isArray(toolName)
        ? toolName
        : [];

  const scopes = new Set<string>();
  for (const name of names) {
    const mapped = TOOL_SCOPE_MAP[name];
    if (mapped) {
      for (const requirement of mapped) {
        scopes.add(
          requirement.action === "write"
            ? restWriteScope(requirement.feature)
            : restReadScope(requirement.feature),
        );
      }
    }
  }

  return Array.from(scopes);
}

export function isMcpWriteTool(name: string): boolean {
  return (
    TOOL_SCOPE_MAP[name]?.some(({ action }) => action === "write") ?? false
  );
}

export function getMcpWriteRateLimitTier(name: string): "batch" | "write" {
  return BATCH_WRITE_TOOLS.has(name) ? "batch" : "write";
}

export function getMcpWriteRateLimitAction(name: string): string {
  const features = Array.from(
    new Set(
      (TOOL_SCOPE_MAP[name] ?? [])
        .filter(({ action }) => action === "write")
        .map(({ feature }) => feature),
    ),
  ).sort();
  if (features.length === 0) {
    throw new Error(`MCP tool ${name} has no write scope`);
  }
  const action = BATCH_WRITE_TOOLS.has(name) ? "batch-write" : "write";
  return `${features.join("+")}:${action}`;
}

type McpJsonRpcMessage = {
  method?: unknown;
  params?: { name?: unknown };
};

function isToolCallMessage(value: unknown): value is McpJsonRpcMessage & {
  method: "tools/call";
  params: { name: string };
} {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as McpJsonRpcMessage).method === "tools/call" &&
    typeof (value as McpJsonRpcMessage).params?.name === "string"
  );
}

/**
 * Parses a JSON-RPC MCP request body and returns tool names in request order,
 * preserving duplicate calls. Only `tools/call` messages are considered;
 * other methods (ping, initialization, `tools/list`, etc.) do not carry a
 * tool-name scope gate.
 *
 * The request is cloned before reading so the original body stream remains
 * available for downstream transport handling.
 */
export function extractMcpToolCallNames(body: unknown): string[] {
  const messages = Array.isArray(body) ? body : [body];
  const names: string[] = [];
  for (const message of messages) {
    if (isToolCallMessage(message)) {
      names.push(message.params.name);
    }
  }

  return names;
}

export async function extractMcpToolCallNamesFromRequest(
  request: Request,
): Promise<string[]> {
  if (request.method !== "POST") return [];
  try {
    return extractMcpToolCallNames(await request.clone().json());
  } catch {
    return [];
  }
}

export async function extractMcpToolNamesFromRequest(
  request: Request,
): Promise<string[]> {
  return Array.from(new Set(await extractMcpToolCallNamesFromRequest(request)));
}
