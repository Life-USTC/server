import { DEV_SEED, DEV_SEED_ANCHOR } from "../../seed/dev-seed";

export type SnapshotAuth = "public" | "debug" | "admin";

export type PageSnapshotAction =
  | "section-calendar-subscription"
  | "section-homework-create"
  | "section-homework-edit";

export type PageSnapshotCase = {
  id: string;
  path: string;
  auth: SnapshotAuth;
  resolvePath?: "teacher-detail" | "user-id" | "comment-detail";
  fullPage?: boolean;
  waitUntil?: "load" | "domcontentloaded";
  note?: string;
  actions?: PageSnapshotAction[];
};

export type ApiSnapshotCase = {
  id: string;
  method: "GET" | "POST";
  path: string;
  auth: SnapshotAuth;
  data?: unknown;
  headers?: Record<string, string>;
  expectedStatus?: number;
  resolvePath?: {
    sectionCode: string;
    target: string;
  };
  note?: string;
};

export type McpSnapshotCase = {
  name: string;
  arguments: Record<string, unknown>;
  note?: string;
};

const SNAPSHOT_AT_QUERY = `snapshotAt=${encodeURIComponent(
  DEV_SEED_ANCHOR.startOfDayAtTime,
)}`;

export const PAGE_SNAPSHOT_CASES: PageSnapshotCase[] = [
  { id: "home", path: "/", auth: "public" },
  { id: "signin", path: "/signin", auth: "public" },
  { id: "settings", path: "/settings", auth: "debug" },
  { id: "api-docs", path: "/api-docs", auth: "public", waitUntil: "load" },
  { id: "privacy", path: "/privacy", auth: "public" },
  { id: "terms", path: "/terms", auth: "public" },
  { id: "mobile-app", path: "/mobile-app", auth: "public" },
  { id: "markdown-guide", path: "/guides/markdown-support", auth: "public" },
  { id: "error", path: "/error", auth: "public" },
  {
    id: "oauth-callback",
    path: "/e2e/oauth/callback",
    auth: "public",
    note: "Technical callback page captured without OAuth params.",
  },
  { id: "bus", path: "/?tab=bus", auth: "public" },
  { id: "bus-map", path: "/bus-map", auth: "public" },
  {
    id: "courses",
    path: `/courses?search=${encodeURIComponent(DEV_SEED.course.code)}`,
    auth: "public",
  },
  {
    id: "course-detail",
    path: `/courses/${DEV_SEED.course.jwId}`,
    auth: "public",
  },
  {
    id: "sections",
    path: `/sections?search=${encodeURIComponent(DEV_SEED.section.code)}`,
    auth: "public",
  },
  {
    id: "section-detail",
    path: `/sections/${DEV_SEED.section.jwId}`,
    auth: "public",
  },
  {
    id: "section-detail-actions",
    path: `/sections/${DEV_SEED.section.jwId}`,
    auth: "debug",
    actions: [
      "section-calendar-subscription",
      "section-homework-create",
      "section-homework-edit",
    ],
    note: "Signed-in section detail action states for calendar subscription and homework forms.",
  },
  {
    id: "teachers",
    path: `/teachers?search=${encodeURIComponent(DEV_SEED.teacher.nameCn)}`,
    auth: "public",
  },
  {
    id: "teacher-detail",
    path: "/teachers/__resolved__",
    auth: "public",
    resolvePath: "teacher-detail",
  },
  { id: "comments-guide", path: "/comments/guide", auth: "public" },
  {
    id: "comment-redirect-target",
    path: "/comments/__resolved__",
    auth: "debug",
    resolvePath: "comment-detail",
    note: "Comment permalinks redirect to the owning target page with a focused comment anchor.",
  },
  {
    id: "user-profile",
    path: `/u/${DEV_SEED.debugUsername}`,
    auth: "public",
  },
  {
    id: "user-id",
    path: "/u/id/__resolved__",
    auth: "debug",
    resolvePath: "user-id",
  },
  {
    id: "dashboard",
    path: `/?tab=overview&${SNAPSHOT_AT_QUERY}`,
    auth: "debug",
  },
  {
    id: "dashboard-calendar",
    path: `/?tab=calendar&${SNAPSHOT_AT_QUERY}`,
    auth: "debug",
  },
  {
    id: "dashboard-todos",
    path: `/?tab=todos&${SNAPSHOT_AT_QUERY}`,
    auth: "debug",
  },
  {
    id: "dashboard-homeworks",
    path: `/?tab=homeworks&${SNAPSHOT_AT_QUERY}`,
    auth: "debug",
  },
  {
    id: "dashboard-exams",
    path: `/?tab=exams&${SNAPSHOT_AT_QUERY}`,
    auth: "debug",
  },
  {
    id: "dashboard-comments",
    path: `/?tab=comments&${SNAPSHOT_AT_QUERY}`,
    auth: "debug",
  },
  {
    id: "dashboard-links",
    path: `/?tab=links&${SNAPSHOT_AT_QUERY}`,
    auth: "debug",
  },
  {
    id: "dashboard-subscriptions-sections",
    path: `/?tab=subscriptions&${SNAPSHOT_AT_QUERY}`,
    auth: "debug",
  },
  { id: "admin", path: "/admin", auth: "admin" },
  { id: "admin-users", path: "/admin/users", auth: "admin" },
  { id: "admin-bus", path: "/admin/bus", auth: "admin" },
  { id: "admin-moderation", path: "/admin/moderation", auth: "admin" },
  { id: "admin-oauth", path: "/admin/oauth", auth: "admin" },
  { id: "oauth-device", path: "/oauth/device", auth: "public" },
  {
    id: "oauth-authorize",
    path: "/oauth/authorize",
    auth: "public",
    note: "Expected to render an invalid-request/consent shell without OAuth params.",
  },
];

export const API_SNAPSHOT_CASES: ApiSnapshotCase[] = [
  { id: "metadata", method: "GET", path: "/api/metadata", auth: "public" },
  { id: "openapi", method: "GET", path: "/api/openapi", auth: "public" },
  {
    id: "me-public",
    method: "GET",
    path: "/api/me",
    auth: "public",
    expectedStatus: 401,
  },
  { id: "me-debug", method: "GET", path: "/api/me", auth: "debug" },
  { id: "semesters", method: "GET", path: "/api/semesters", auth: "public" },
  {
    id: "current-semester",
    method: "GET",
    path: "/api/semesters/current",
    auth: "public",
  },
  {
    id: "courses-search",
    method: "GET",
    path: `/api/courses?search=${encodeURIComponent(DEV_SEED.course.code)}&limit=5`,
    auth: "public",
  },
  {
    id: "course-detail",
    method: "GET",
    path: `/api/courses/${DEV_SEED.course.jwId}`,
    auth: "public",
  },
  {
    id: "sections-search",
    method: "GET",
    path: `/api/sections?search=${encodeURIComponent(DEV_SEED.section.code)}&limit=5`,
    auth: "public",
  },
  {
    id: "section-detail",
    method: "GET",
    path: `/api/sections/${DEV_SEED.section.jwId}`,
    auth: "public",
  },
  {
    id: "section-schedules",
    method: "GET",
    path: `/api/sections/${DEV_SEED.section.jwId}/schedules`,
    auth: "public",
  },
  {
    id: "section-schedule-groups",
    method: "GET",
    path: `/api/sections/${DEV_SEED.section.jwId}/schedule-groups`,
    auth: "public",
  },
  {
    id: "section-match-codes",
    method: "POST",
    path: "/api/sections/match-codes",
    auth: "public",
    data: { codes: [DEV_SEED.section.code, "NOT-EXIST-CODE"] },
  },
  {
    id: "teachers-search",
    method: "GET",
    path: `/api/teachers?search=${encodeURIComponent(DEV_SEED.teacher.nameCn)}&limit=5`,
    auth: "public",
  },
  { id: "bus", method: "GET", path: "/api/bus", auth: "public" },
  {
    id: "bus-preferences",
    method: "GET",
    path: "/api/bus/preferences",
    auth: "debug",
  },
  {
    id: "comments",
    method: "GET",
    path: "/api/comments?targetType=section&targetId=__section_id__",
    auth: "debug",
    resolvePath: {
      sectionCode: DEV_SEED.section.code,
      target: "/api/comments?targetType=section&targetId=__section_id__",
    },
  },
  { id: "todos", method: "GET", path: "/api/todos", auth: "debug" },
  {
    id: "homeworks",
    method: "GET",
    path: "/api/homeworks?sectionId=__section_id__",
    auth: "debug",
    resolvePath: {
      sectionCode: DEV_SEED.section.code,
      target: "/api/homeworks?sectionId=__section_id__",
    },
  },
  { id: "schedules", method: "GET", path: "/api/schedules", auth: "debug" },
  {
    id: "calendar-subscription-current",
    method: "GET",
    path: "/api/calendar-subscriptions/current",
    auth: "debug",
  },
  {
    id: "admin-users",
    method: "GET",
    path: "/api/admin/users?limit=5",
    auth: "admin",
  },
  {
    id: "admin-comments",
    method: "GET",
    path: "/api/admin/comments?limit=5",
    auth: "admin",
  },
  {
    id: "admin-suspensions",
    method: "GET",
    path: "/api/admin/suspensions",
    auth: "admin",
  },
];

export const MCP_SNAPSHOT_CASES: McpSnapshotCase[] = [
  { name: "get_my_profile", arguments: {} },
  { name: "list_my_todos", arguments: {} },
  {
    name: "search_courses",
    arguments: { search: DEV_SEED.course.code, limit: 5, locale: "zh-cn" },
  },
  {
    name: "get_section_by_jw_id",
    arguments: { jwId: DEV_SEED.section.jwId, locale: "zh-cn" },
  },
  {
    name: "match_section_codes",
    arguments: {
      codes: [DEV_SEED.section.code, "NOT-EXIST-CODE"],
      locale: "zh-cn",
    },
  },
  {
    name: "list_homeworks_by_section",
    arguments: {
      sectionJwId: DEV_SEED.section.jwId,
      includeDeleted: false,
      locale: "zh-cn",
    },
  },
  {
    name: "list_schedules_by_section",
    arguments: {
      sectionJwId: DEV_SEED.section.jwId,
      limit: 5,
      locale: "zh-cn",
    },
  },
  {
    name: "list_exams_by_section",
    arguments: { sectionJwId: DEV_SEED.section.jwId, locale: "zh-cn" },
  },
  {
    name: "list_my_homeworks",
    arguments: { completed: false, limit: 10, locale: "zh-cn" },
  },
  { name: "list_my_schedules", arguments: { limit: 10, locale: "zh-cn" } },
  {
    name: "list_my_exams",
    arguments: { includeDateUnknown: true, limit: 10, locale: "zh-cn" },
  },
  {
    name: "get_my_overview",
    arguments: {
      locale: "zh-cn",
      atTime: DEV_SEED_ANCHOR.startOfDayAtTime,
    },
  },
  {
    name: "get_my_7days_timeline",
    arguments: {
      locale: "zh-cn",
      atTime: DEV_SEED_ANCHOR.startOfDayAtTime,
    },
  },
  { name: "get_my_calendar_subscription", arguments: { locale: "zh-cn" } },
  {
    name: "get_my_dashboard",
    arguments: {
      locale: "zh-cn",
      mode: "summary",
      atTime: DEV_SEED_ANCHOR.startOfDayAtTime,
    },
  },
  {
    name: "get_next_class",
    arguments: {
      locale: "zh-cn",
      atTime: DEV_SEED_ANCHOR.startOfDayAtTime,
    },
  },
  {
    name: "list_bus_routes",
    arguments: { locale: "zh-cn", summary: true },
  },
  {
    name: "get_next_buses",
    arguments: {
      locale: "zh-cn",
      originCampusId: DEV_SEED.bus.originCampusId,
      destinationCampusId: DEV_SEED.bus.destinationCampusId,
      atTime: DEV_SEED_ANCHOR.recommendedAtTime,
      limit: 5,
    },
  },
];
