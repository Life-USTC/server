import { type McpFeature, mcpScope } from "@/lib/oauth/constants";

/**
 * Maps every registered MCP tool name to the feature scope(s) it belongs to.
 *
 * Tools that are not present in this map fall back to requiring only the generic
 * MCP scope check performed by `authenticateMcpRequest` (i.e. any valid MCP
 * scope, including the legacy `mcp:tools`). This keeps the registry additive:
 * adding a new tool does not break callers until an explicit scope is assigned.
 */
const TOOL_SCOPE_MAP: Record<string, McpFeature[]> = {
  // Profile
  get_my_profile: ["profile"],
  get_public_user_profile: ["profile"],

  // Todos
  list_my_todos: ["todo"],
  create_my_todo: ["todo"],
  update_my_todo: ["todo"],
  delete_my_todo: ["todo"],

  // Homeworks
  list_my_homeworks: ["homework"],
  set_my_homework_completion: ["homework"],
  list_homeworks_by_section: ["homework"],
  create_homework_on_section: ["homework"],
  update_homework_on_section: ["homework"],
  delete_homework_on_section: ["homework"],

  // Section subscriptions
  get_my_calendar_subscription: ["subscription"],
  list_my_subscribed_sections: ["subscription"],
  subscribe_section_by_jw_id: ["subscription"],
  unsubscribe_section_by_jw_id: ["subscription"],
  subscribe_my_sections_by_codes: ["subscription"],
  get_section_calendar_subscription: ["subscription"],

  // Calendar
  list_my_calendar_events: ["calendar"],
  get_my_7days_timeline: ["calendar", "dashboard"],

  // Comments
  list_comments: ["comment"],
  get_comment_thread: ["comment"],
  create_comment: ["comment"],
  update_own_comment: ["comment"],
  delete_own_comment: ["comment"],
  add_comment_reaction: ["comment"],
  remove_comment_reaction: ["comment"],

  // Descriptions
  get_description: ["description"],
  upsert_description: ["description"],

  // Uploads
  list_my_uploads: ["upload"],
  rename_my_upload: ["upload"],
  delete_my_upload: ["upload"],

  // Dashboard / overview
  get_my_dashboard: ["dashboard"],
  list_dashboard_links: ["dashboard"],
  set_dashboard_link_pin_state: ["dashboard"],
  get_upcoming_deadlines: ["dashboard"],
  get_my_overview: ["dashboard"],
  get_next_class: ["dashboard", "schedule"],

  // Bus
  query_bus_timetable: ["bus"],
  list_bus_routes: ["bus"],
  get_bus_route_timetable: ["bus"],
  get_my_bus_preferences: ["bus"],
  save_my_bus_preferences: ["bus"],
  search_bus_routes: ["bus"],
  get_next_buses: ["bus"],

  // Course catalog
  search_courses: ["course"],
  get_course_by_jw_id: ["course"],
  list_semesters: ["course"],
  get_current_semester: ["course"],

  // Sections
  get_section_by_jw_id: ["section"],
  search_sections: ["section"],
  match_section_codes: ["section"],

  // Teachers
  search_teachers: ["teacher"],
  get_teacher_by_id: ["teacher"],

  // Schedules
  query_schedules: ["schedule"],
  list_schedules_by_section: ["schedule"],
  list_my_schedules: ["schedule"],

  // Exams
  list_exams_by_section: ["exam"],
  list_my_exams: ["exam"],
};

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

  const features = new Set<McpFeature>();
  for (const name of names) {
    const mapped = TOOL_SCOPE_MAP[name];
    if (mapped) {
      for (const feature of mapped) {
        features.add(feature);
      }
    }
  }

  return Array.from(features).map(mcpScope);
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
 * Parses a JSON-RPC MCP request body and returns the distinct tool names being
 * invoked. Only `tools/call` messages are considered; other methods (ping,
 * initialization, `tools/list`, etc.) do not carry a tool-name scope gate.
 *
 * The request is cloned before reading so the original body stream remains
 * available for downstream transport handling.
 */
export async function extractMcpToolNamesFromRequest(
  request: Request,
): Promise<string[]> {
  if (request.method !== "POST") {
    return [];
  }

  let body: unknown;
  try {
    body = await request.clone().json();
  } catch {
    return [];
  }

  const messages = Array.isArray(body) ? body : [body];
  const names = new Set<string>();
  for (const message of messages) {
    if (isToolCallMessage(message)) {
      names.add(message.params.name);
    }
  }

  return Array.from(names);
}
