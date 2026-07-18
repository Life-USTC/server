import {
  type RestFeature,
  restReadScope,
  restWriteScope,
} from "@/lib/oauth/constants";

type ToolScopeRequirement = {
  action: "read" | "write";
  feature: RestFeature;
};

const BATCH_WRITE_TOOLS = new Set(["subscribe_my_sections_by_codes"]);

/**
 * Maps every registered MCP tool name to the feature action scope(s) it needs.
 *
 * Registered tools must be present in this map; server startup asserts that
 * registration, scope, and output-schema metadata stay aligned. Unknown RPC
 * tool names still fall back to the generic MCP request scope before the SDK
 * returns its tool-not-found response.
 */
const TOOL_SCOPE_MAP: Record<string, ToolScopeRequirement[]> = {
  // Profile
  get_my_profile: [{ feature: "me", action: "read" }],
  get_public_user_profile: [{ feature: "me", action: "read" }],

  // Todos
  list_my_todos: [{ feature: "todo", action: "read" }],
  create_my_todo: [{ feature: "todo", action: "write" }],
  update_my_todo: [{ feature: "todo", action: "write" }],
  delete_my_todo: [{ feature: "todo", action: "write" }],

  // Homeworks
  list_my_homeworks: [{ feature: "homework", action: "read" }],
  set_my_homework_completion: [{ feature: "homework", action: "write" }],
  list_homeworks_by_section: [{ feature: "homework", action: "read" }],
  create_homework_on_section: [{ feature: "homework", action: "write" }],
  update_homework_on_section: [{ feature: "homework", action: "write" }],
  delete_homework_on_section: [{ feature: "homework", action: "write" }],

  // Section subscriptions
  get_my_calendar_subscription: [{ feature: "subscription", action: "read" }],
  list_my_subscribed_sections: [{ feature: "subscription", action: "read" }],
  subscribe_section_by_jw_id: [{ feature: "subscription", action: "write" }],
  unsubscribe_section_by_jw_id: [{ feature: "subscription", action: "write" }],
  subscribe_my_sections_by_codes: [
    { feature: "subscription", action: "write" },
  ],
  get_section_calendar_subscription: [
    { feature: "subscription", action: "read" },
  ],

  // Calendar
  list_my_calendar_events: [{ feature: "schedule", action: "read" }],
  get_my_7days_timeline: [
    { feature: "schedule", action: "read" },
    { feature: "dashboard", action: "read" },
  ],

  // Comments
  list_comments: [{ feature: "comment", action: "read" }],
  get_comment_thread: [{ feature: "comment", action: "read" }],
  create_comment: [{ feature: "comment", action: "write" }],
  update_own_comment: [{ feature: "comment", action: "write" }],
  delete_own_comment: [{ feature: "comment", action: "write" }],
  add_comment_reaction: [{ feature: "comment", action: "write" }],
  remove_comment_reaction: [{ feature: "comment", action: "write" }],

  // Descriptions
  get_description: [{ feature: "description", action: "read" }],
  upsert_description: [{ feature: "description", action: "write" }],

  // Uploads
  list_my_uploads: [{ feature: "upload", action: "read" }],
  rename_my_upload: [{ feature: "upload", action: "write" }],
  delete_my_upload: [{ feature: "upload", action: "write" }],

  // Dashboard / overview
  get_my_dashboard: [{ feature: "dashboard", action: "read" }],
  list_dashboard_links: [{ feature: "dashboard", action: "read" }],
  set_dashboard_link_pin_state: [{ feature: "dashboard", action: "write" }],
  get_upcoming_deadlines: [{ feature: "dashboard", action: "read" }],
  get_my_overview: [{ feature: "dashboard", action: "read" }],
  get_next_class: [
    { feature: "dashboard", action: "read" },
    { feature: "schedule", action: "read" },
  ],

  // Bus
  query_bus_timetable: [{ feature: "bus", action: "read" }],
  list_bus_routes: [{ feature: "bus", action: "read" }],
  get_bus_route_timetable: [{ feature: "bus", action: "read" }],
  get_my_bus_preferences: [{ feature: "bus", action: "read" }],
  save_my_bus_preferences: [{ feature: "bus", action: "write" }],
  search_bus_routes: [{ feature: "bus", action: "read" }],
  get_next_buses: [{ feature: "bus", action: "read" }],

  // Course catalog
  search_courses: [{ feature: "course", action: "read" }],
  get_course_by_jw_id: [{ feature: "course", action: "read" }],
  list_semesters: [{ feature: "course", action: "read" }],
  get_current_semester: [{ feature: "course", action: "read" }],

  // Sections
  get_section_by_jw_id: [{ feature: "section", action: "read" }],
  search_sections: [{ feature: "section", action: "read" }],
  match_section_codes: [{ feature: "section", action: "read" }],

  // Teachers
  search_teachers: [{ feature: "teacher", action: "read" }],
  get_teacher_by_id: [{ feature: "teacher", action: "read" }],

  // Schedules
  query_schedules: [{ feature: "schedule", action: "read" }],
  list_schedules_by_section: [{ feature: "schedule", action: "read" }],
  list_my_schedules: [{ feature: "schedule", action: "read" }],

  // Exams
  list_exams_by_section: [{ feature: "exam", action: "read" }],
  list_my_exams: [{ feature: "exam", action: "read" }],
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
