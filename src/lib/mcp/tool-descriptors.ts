import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { PUBLIC_REST_SCOPES } from "@/lib/oauth/scope-registry";
import { getRequiredMcpScopes } from "./tool-scopes";

type ToolSecurityScheme = {
  type: "oauth2";
  scopes: string[];
};

type ToolDescriptorDefaults = {
  title: string;
  outputSchema: z.ZodType;
  annotations: ToolAnnotations;
  _meta: {
    securitySchemes: ToolSecurityScheme[];
  };
};

const STRUCTURED_CONTENT_OUTPUT_SCHEMA = z
  .object({})
  .catchall(z.unknown())
  .describe("Open object returned in structuredContent.");

const COMMON_OUTPUT_KEYS = [
  "success",
  "found",
  "error",
  "message",
  "hint",
  "result",
];
const OPTIONAL_UNKNOWN_SCHEMA = z.unknown().optional();

const OPEN_WORLD_WRITE_TOOLS = new Set([
  "add_comment_reaction",
  "create_comment",
  "create_homework_on_section",
  "delete_homework_on_section",
  "delete_own_comment",
  "remove_comment_reaction",
  "update_homework_on_section",
  "update_own_comment",
  "upsert_description",
]);

const DESTRUCTIVE_WRITE_PREFIXES = [
  "delete_",
  "remove_",
  "rename_",
  "save_",
  "set_",
  "unsubscribe_",
  "update_",
  "upsert_",
];

function humanizeToolName(name: string) {
  return name
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function structuredContentOutputSchema(keys: string[]) {
  const shape = Object.fromEntries(
    [...new Set([...keys, ...COMMON_OUTPUT_KEYS])].map((key) => [
      key,
      OPTIONAL_UNKNOWN_SCHEMA,
    ]),
  ) as Record<string, typeof OPTIONAL_UNKNOWN_SCHEMA>;

  return z
    .object(shape)
    .catchall(z.unknown())
    .describe("Object returned in structuredContent.");
}

// Keep schemas top-level only: nested payloads vary across summary/default/full modes.
const TOOL_OUTPUT_SCHEMAS: Record<string, z.ZodType> = {
  get_my_profile: structuredContentOutputSchema([
    "id",
    "name",
    "username",
    "email",
    "image",
    "roles",
  ]),
  get_public_user_profile: structuredContentOutputSchema([
    "id",
    "name",
    "username",
    "image",
  ]),
  list_my_todos: structuredContentOutputSchema(["counts", "todos"]),
  create_my_todo: structuredContentOutputSchema(["id"]),
  update_my_todo: structuredContentOutputSchema(["todo"]),
  delete_my_todo: structuredContentOutputSchema([]),

  list_my_homeworks: structuredContentOutputSchema(["homeworks"]),
  set_my_homework_completion: structuredContentOutputSchema(["completion"]),
  list_homeworks_by_section: structuredContentOutputSchema([
    "section",
    "homeworks",
  ]),
  create_homework_on_section: structuredContentOutputSchema([
    "id",
    "homework",
    "reason",
  ]),
  update_homework_on_section: structuredContentOutputSchema([
    "homework",
    "reason",
  ]),
  delete_homework_on_section: structuredContentOutputSchema([
    "deletedId",
    "alreadyDeleted",
    "reason",
  ]),

  get_my_calendar_subscription: structuredContentOutputSchema(["subscription"]),
  list_my_subscribed_sections: structuredContentOutputSchema([
    "sections",
    "note",
  ]),
  subscribe_section_by_jw_id: structuredContentOutputSchema([
    "action",
    "sectionJwId",
    "subscription",
  ]),
  unsubscribe_section_by_jw_id: structuredContentOutputSchema([
    "action",
    "sectionJwId",
    "subscription",
  ]),
  subscribe_my_sections_by_codes: structuredContentOutputSchema([
    "semester",
    "matchedCodes",
    "unmatchedCodes",
    "addedCount",
    "alreadySubscribedCount",
    "subscription",
  ]),
  get_section_calendar_subscription: structuredContentOutputSchema([
    "section",
    "calendarPath",
    "calendarUrl",
  ]),

  list_my_calendar_events: structuredContentOutputSchema(["events"]),
  get_my_7days_timeline: structuredContentOutputSchema([
    "range",
    "total",
    "events",
  ]),

  list_comments: structuredContentOutputSchema([
    "comments",
    "hiddenCount",
    "viewer",
    "target",
  ]),
  get_comment_thread: structuredContentOutputSchema([
    "thread",
    "focusId",
    "hiddenCount",
    "viewer",
    "target",
  ]),
  create_comment: structuredContentOutputSchema(["id"]),
  update_own_comment: structuredContentOutputSchema(["comment"]),
  delete_own_comment: structuredContentOutputSchema([]),
  add_comment_reaction: structuredContentOutputSchema(["changed"]),
  remove_comment_reaction: structuredContentOutputSchema(["changed"]),

  get_description: structuredContentOutputSchema([
    "target",
    "description",
    "history",
    "viewer",
  ]),
  upsert_description: structuredContentOutputSchema([
    "id",
    "updated",
    "target",
    "description",
    "history",
    "viewer",
  ]),

  list_my_uploads: structuredContentOutputSchema([
    "uploads",
    "quota",
    "limits",
  ]),
  rename_my_upload: structuredContentOutputSchema(["upload", "reason"]),
  delete_my_upload: structuredContentOutputSchema([
    "deletedId",
    "deletedSize",
    "reason",
  ]),

  get_my_dashboard: structuredContentOutputSchema([
    "user",
    "currentSemester",
    "subscriptions",
    "nextClass",
    "upcomingDeadlines",
    "upcomingEvents",
    "todos",
    "bus",
  ]),
  list_dashboard_links: structuredContentOutputSchema([
    "query",
    "total",
    "returned",
    "dashboardLinks",
    "pinnedSlugs",
    "maxPinnedLinks",
  ]),
  set_dashboard_link_pin_state: structuredContentOutputSchema([
    "action",
    "slug",
    "pinnedSlugs",
    "maxPinnedLinks",
  ]),
  get_upcoming_deadlines: structuredContentOutputSchema(["total", "deadlines"]),
  get_my_overview: structuredContentOutputSchema([
    "user",
    "overview",
    "samples",
  ]),
  get_next_class: structuredContentOutputSchema([
    "nextClass",
    "currentSemester",
  ]),

  query_bus_timetable: structuredContentOutputSchema([
    "locale",
    "fetchedAt",
    "version",
    "counts",
    "campuses",
    "routes",
    "trips",
    "preferences",
    "nextDepartures",
    "nextDeparturesMessage",
    "notice",
    "hasData",
  ]),
  list_bus_routes: structuredContentOutputSchema([
    "locale",
    "version",
    "campuses",
    "routes",
    "notice",
  ]),
  get_bus_route_timetable: structuredContentOutputSchema([
    "routeId",
    "route",
    "version",
    "trips",
    "stops",
    "hasData",
  ]),
  get_my_bus_preferences: structuredContentOutputSchema(["preferences"]),
  save_my_bus_preferences: structuredContentOutputSchema(["preferences"]),
  search_bus_routes: structuredContentOutputSchema([
    "routes",
    "trips",
    "campuses",
    "hasData",
  ]),
  get_next_buses: structuredContentOutputSchema([
    "departures",
    "nextAvailableDeparture",
    "originCampus",
    "destinationCampus",
    "hasData",
  ]),

  search_courses: structuredContentOutputSchema(["data", "pagination"]),
  get_course_by_jw_id: structuredContentOutputSchema(["course"]),
  list_semesters: structuredContentOutputSchema(["data", "pagination"]),
  get_current_semester: structuredContentOutputSchema(["semester"]),

  get_section_by_jw_id: structuredContentOutputSchema(["section"]),
  search_sections: structuredContentOutputSchema(["data", "pagination"]),
  match_section_codes: structuredContentOutputSchema([
    "semester",
    "matchedCodes",
    "unmatchedCodes",
    "suggestions",
    "sections",
    "total",
    "note",
  ]),

  search_teachers: structuredContentOutputSchema(["data", "pagination"]),
  get_teacher_by_id: structuredContentOutputSchema(["teacher"]),

  query_schedules: structuredContentOutputSchema(["data", "pagination"]),
  list_schedules_by_section: structuredContentOutputSchema([
    "section",
    "schedules",
  ]),
  list_my_schedules: structuredContentOutputSchema(["schedules"]),

  list_exams_by_section: structuredContentOutputSchema(["section", "exams"]),
  list_my_exams: structuredContentOutputSchema(["exams"]),
};

function isWriteScope(scope: string) {
  return scope.endsWith(":write");
}

function isDestructiveWriteTool(name: string) {
  return DESTRUCTIVE_WRITE_PREFIXES.some((prefix) => name.startsWith(prefix));
}

export function getMcpToolDescriptorDefaults(
  name: string,
): ToolDescriptorDefaults {
  const requiredScopes = getRequiredMcpScopes(name);
  const scopes =
    requiredScopes.length > 0 ? requiredScopes : [...PUBLIC_REST_SCOPES];
  const isWrite = scopes.some(isWriteScope);
  const title = humanizeToolName(name);

  return {
    title,
    outputSchema: TOOL_OUTPUT_SCHEMAS[name] ?? STRUCTURED_CONTENT_OUTPUT_SCHEMA,
    annotations: {
      title,
      readOnlyHint: !isWrite,
      destructiveHint: isWrite && isDestructiveWriteTool(name),
      openWorldHint: isWrite && OPEN_WORLD_WRITE_TOOLS.has(name),
    },
    _meta: {
      securitySchemes: [{ type: "oauth2", scopes }],
    },
  };
}

export function installMcpToolDescriptorDefaults(server: McpServer) {
  const registerTool = server.registerTool.bind(server);

  server.registerTool = ((name, config, callback) => {
    const defaults = getMcpToolDescriptorDefaults(name);
    const mergedConfig = {
      ...config,
      title: config.title ?? defaults.title,
      outputSchema: config.outputSchema ?? defaults.outputSchema,
      annotations: {
        ...defaults.annotations,
        ...config.annotations,
      },
      _meta: {
        ...defaults._meta,
        ...config._meta,
        securitySchemes:
          config._meta?.securitySchemes ?? defaults._meta.securitySchemes,
      },
    } as typeof config;

    return registerTool(name, mergedConfig, callback);
  }) as typeof server.registerTool;
}
