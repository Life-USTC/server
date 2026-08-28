/**
 * Canonical page inventory for L0/L1/L2 UI coverage.
 *
 * Derived from src/routes/+page.svelte trees. Keep this map complete — the unit
 * gate in tests/unit/page-inventory.test.ts fails when a route is orphaned.
 */
import { workspaceTabIds } from "@/features/dashboard/lib/dashboard-nav";
import { SETTINGS_TABS } from "@/features/settings/lib/settings-tabs";
import { DEV_SEED } from "../../../../fixtures/dev-seed";

export type PageAuth = "public" | "user" | "admin";
export type PageKind = "page" | "redirect";
export type MobileScreenshotGroup = "public" | "authed" | "admin";

export type MobileCoverageReference = {
  /** Spec path relative to tests/e2e/. */
  e2eSpec: string;
  /** Exact test title fragment that owns the mobile contract. */
  testName: string;
  /** Why the generic inventory-driven mobile route cannot own this case. */
  reason: string;
};

export type PrimaryActionExemption =
  | "decorative"
  | "live-oauth"
  | `covered-by:${string}`;

export type PrimaryAction = {
  /** Stable id for the gate (not a DOM selector). */
  id: string;
  /** Role/name pair preferred by e2e/AGENTS.md, when applicable. */
  role?: "button" | "link" | "tab" | "textbox" | "combobox" | "searchbox";
  name?: string;
  testId?: string;
  /** Spec path relative to tests/e2e/ that exercises this action. */
  e2eSpec?: string;
  /** Exact source fragment tying aggregate capability coverage to the spec. */
  evidence?: string;
  /** Explicit exemption when no dedicated L2 assertion is required. */
  exemption?: PrimaryActionExemption;
};

export type PageInventoryEntry = {
  routeId: string;
  samplePath: string;
  kind: PageKind;
  auth: PageAuth;
  /** Path passed to assertPageContract (may differ for redirects). */
  contractPath: string;
  /**
   * Spec under tests/e2e/ that calls assertPageContract for this entry,
   * or coveredBy when a sibling rich spec already owns the contract call.
   */
  e2eSpec?: string;
  coveredBy?: string;
  primaryActions?: PrimaryAction[];
  /** Drive one or more authenticated-state mobile checks from the inventory. */
  mobileScreenshots?: readonly MobileScreenshotGroup[];
  /** Dedicated mobile scenario for pages that need fixture setup or richer UI checks. */
  mobileCoveredBy?: MobileCoverageReference;
};

const E2E = {
  home: "src/app/test.ts",
  admin: "src/app/admin/test.ts",
  adminAnalytics: "src/app/admin/audit/test.ts",
  adminAudit: "src/app/admin/audit/test.ts",
  adminUsers: "src/app/admin/users/test.ts",
  adminModeration: "src/app/admin/moderation/test.ts",
  adminOauth: "src/app/admin/oauth/test.ts",
  adminBus: "src/app/admin/bus/test.ts",
  apiDocs: "src/app/api/docs/test.ts",
  bus: "src/app/bus/test.ts",
  busMap: "src/app/bus-map/test.ts",
  commentsGuide: "src/app/comments/guide/test.ts",
  commentsId: "src/app/comments/[id]/test.ts",
  courses: "src/app/courses/test.ts",
  coursesJwId: "src/app/courses/[jwId]/test.ts",
  dashboard: "src/app/dashboard/test.ts",
  dashboardTab: "src/app/dashboard/[tab]/test.ts",
  dashboardLinks: "src/app/dashboard/links/test.ts",
  dashboardCalendar: "src/app/dashboard/calendar/test.ts",
  dashboardHomeworks: "src/app/dashboard/homeworks/test.ts",
  dashboardTodos: "src/app/dashboard/todos/test.ts",
  dashboardExams: "src/app/dashboard/exams/test.ts",
  dashboardSubscriptions: "src/app/dashboard/subscriptions/sections/test.ts",
  e2eOauthCallback: "src/app/e2e/oauth/callback/test.ts",
  error: "src/app/error/test.ts",
  guidesMarkdown: "src/app/guides/markdown-support/test.ts",
  usage: "src/app/usage/test.ts",
  oauthAuthorize: "src/app/oauth/authorize/test.ts",
  oauthDevice: "src/app/oauth/device/test.ts",
  privacy: "src/app/privacy/test.ts",
  search: "src/app/search/test.ts",
  sections: "src/app/sections/test.ts",
  sectionsJwId: "src/app/sections/[jwId]/test.ts",
  settings: "src/app/settings/test.ts",
  settingsProfile: "src/app/settings/profile/test.ts",
  settingsPreferences: "src/app/settings/preferences/test.ts",
  settingsAccounts: "src/app/settings/accounts/test.ts",
  settingsSecurity: "src/app/settings/security/test.ts",
  settingsAuthorizations: "src/app/settings/authorizations/test.ts",
  settingsDanger: "src/app/settings/danger/test.ts",
  settingsPasskeys: "src/app/settings/passkeys/test.ts",
  signin: "src/app/signin/test.ts",
  teachers: "src/app/teachers/test.ts",
  teachersId: "src/app/teachers/[id]/test.ts",
  terms: "src/app/terms/test.ts",
  communityUser: "src/app/u/[username]/test.ts",
  welcome: "src/app/welcome/test.ts",
} as const;

/**
 * Tab ids reused so settings / workspace inventory stays DRY with product code.
 * Exported for unit gate cross-checks.
 */
export const INVENTORY_SETTINGS_TABS = SETTINGS_TABS;
export const INVENTORY_WORKSPACE_TABS = workspaceTabIds;

/** Browser-facing aliases implemented without +page.svelte files. */
export const BROWSER_ALIAS_INVENTORY = [
  {
    path: "/api-docs",
    target: "/api/docs/tag/catalog-section",
    e2eSpec: E2E.apiDocs,
    testName: "重定向到 /api/docs",
  },
] as const;

export const PAGE_INVENTORY: readonly PageInventoryEntry[] = [
  {
    routeId: "/",
    samplePath: "/",
    kind: "page",
    auth: "public",
    contractPath: "/",
    e2eSpec: E2E.home,
    mobileScreenshots: ["public"],
    primaryActions: [
      {
        id: "nav-courses",
        role: "link",
        name: "/^(课程|Courses)$/i",
        e2eSpec: E2E.home,
      },
      {
        id: "theme-menu",
        role: "button",
        e2eSpec: E2E.home,
      },
    ],
  },
  {
    routeId: "/account/settings",
    samplePath: "/account/settings",
    kind: "redirect",
    auth: "user",
    contractPath: "/account/settings",
    e2eSpec: E2E.settings,
  },
  {
    routeId: "/account/settings/[tab]",
    samplePath: "/account/settings/profile",
    kind: "page",
    auth: "user",
    contractPath: "/account/settings/profile",
    e2eSpec: E2E.settingsProfile,
    coveredBy: E2E.settings,
    mobileScreenshots: ["authed"],
    primaryActions: [
      {
        id: "save-profile",
        role: "button",
        name: "/保存|Save/i",
        e2eSpec: E2E.settingsProfile,
      },
      {
        id: "preferences-appearance",
        e2eSpec: E2E.settingsPreferences,
        evidence: "外观选择立即应用并写入既有 localStorage",
      },
      {
        id: "accounts-providers",
        e2eSpec: E2E.settingsAccounts,
        evidence: "显示所有提供商卡片",
      },
      {
        id: "accounts-ustc-connect",
        role: "button",
        name: "/连接|Connect/i",
        exemption: "live-oauth",
      },
      {
        id: "authorizations-list",
        e2eSpec: E2E.settingsAuthorizations,
        evidence: "仅显示安全的客户端信息，并支持确认后立即撤销",
      },
      {
        id: "security-activity",
        e2eSpec: E2E.settingsSecurity,
        evidence: "敏感活动分页展示且网络与设备信息脱敏",
      },
      {
        id: "danger-delete",
        e2eSpec: E2E.settingsDanger,
        evidence: "删除账号确认流程",
      },
      {
        id: "passkeys-ui",
        e2eSpec: E2E.settingsPasskeys,
        evidence: "注册、退出、通行密钥登录、重命名和删除",
      },
      ...SETTINGS_TABS.map(
        (tab): PrimaryAction => ({
          id: `settings-tab-${tab}`,
          role: "link",
          e2eSpec: E2E.settings,
        }),
      ),
    ],
  },
  {
    routeId: "/account/sign-in",
    samplePath: "/account/sign-in",
    kind: "page",
    auth: "public",
    contractPath: "/account/sign-in",
    e2eSpec: E2E.signin,
    mobileScreenshots: ["public"],
    primaryActions: [
      {
        id: "provider-ustc",
        role: "button",
        name: "/USTC/i",
        e2eSpec: E2E.signin,
      },
      {
        id: "provider-github",
        role: "button",
        name: "/GitHub/i",
        e2eSpec: E2E.signin,
      },
      {
        id: "provider-google",
        role: "button",
        name: "/Google/i",
        e2eSpec: E2E.signin,
      },
    ],
  },
  {
    routeId: "/account/welcome",
    samplePath: "/account/welcome",
    kind: "page",
    auth: "user",
    contractPath: "/account/welcome",
    e2eSpec: E2E.welcome,
    mobileCoveredBy: {
      e2eSpec: "mobile-screenshots/screenshots.spec.ts",
      testName: "/account/welcome 页面截图",
      reason:
        "The welcome page requires temporarily clearing and restoring the seeded user's profile.",
    },
    primaryActions: [
      {
        id: "welcome-name",
        role: "textbox",
        name: "/^(姓名|Name)\\b/i",
        e2eSpec: E2E.welcome,
      },
      {
        id: "welcome-username",
        role: "textbox",
        name: "/^(用户名|Username)\\b/i",
        e2eSpec: E2E.welcome,
      },
      {
        id: "welcome-avatar-upload",
        role: "button",
        name: "/上传自己的头像|Upload your own avatar/i",
        e2eSpec: E2E.welcome,
      },
      {
        id: "welcome-complete",
        role: "button",
        name: "/继续|Continue/i",
        e2eSpec: E2E.welcome,
      },
      {
        id: "bulk-import",
        role: "button",
        name: "/^(导入|Import)$/i",
        e2eSpec: E2E.welcome,
      },
      {
        id: "welcome-undergraduate-academic",
        role: "link",
        name: "/^(本科生教务|Undergraduate academic system)$/i",
        e2eSpec: E2E.welcome,
      },
      {
        id: "welcome-graduate-academic",
        role: "link",
        name: "/^(研究生教务|Graduate academic system)$/i",
        e2eSpec: E2E.welcome,
      },
      {
        id: "welcome-skip-step",
        role: "link",
        name: "/暂时跳过|Skip for now/i",
        e2eSpec: E2E.welcome,
      },
      {
        id: "welcome-finish",
        role: "link",
        name: "/进入工作区|Go to workspace/i",
        e2eSpec: E2E.welcome,
      },
      {
        id: "welcome-back-step",
        role: "link",
        name: "/上一步|Back/i",
        e2eSpec: E2E.welcome,
      },
    ],
  },
  {
    routeId: "/admin",
    samplePath: "/admin",
    kind: "redirect",
    auth: "admin",
    contractPath: "/admin",
    e2eSpec: E2E.admin,
  },
  {
    routeId: "/admin/analytics",
    samplePath: "/admin/analytics",
    kind: "page",
    auth: "admin",
    contractPath: "/admin/analytics",
    e2eSpec: E2E.adminAnalytics,
    mobileScreenshots: ["admin"],
    primaryActions: [
      {
        id: "analytics-window",
        role: "link",
        name: "/最近 30 天|Last 30 days/i",
        e2eSpec: E2E.adminAnalytics,
      },
    ],
  },
  {
    routeId: "/admin/audit",
    samplePath: "/admin/audit",
    kind: "page",
    auth: "admin",
    contractPath: "/admin/audit",
    e2eSpec: E2E.adminAudit,
    mobileScreenshots: ["admin"],
    primaryActions: [
      {
        id: "apply-audit-filters",
        role: "button",
        name: "/应用筛选|Apply filters/i",
        e2eSpec: E2E.adminAudit,
      },
    ],
  },
  {
    routeId: "/admin/bus",
    samplePath: "/admin/bus",
    kind: "page",
    auth: "admin",
    contractPath: "/admin/bus",
    e2eSpec: E2E.adminBus,
    mobileScreenshots: ["admin"],
    primaryActions: [
      {
        id: "import-bus",
        role: "button",
        name: "/导入|Import/i",
        e2eSpec: E2E.adminBus,
      },
    ],
  },
  {
    routeId: "/admin/moderation",
    samplePath: "/admin/moderation",
    kind: "page",
    auth: "admin",
    contractPath: "/admin/moderation",
    e2eSpec: E2E.adminModeration,
    mobileScreenshots: ["admin"],
    primaryActions: [
      {
        id: "status-filter",
        role: "combobox",
        e2eSpec: E2E.adminModeration,
      },
      {
        id: "comments-link",
        role: "link",
        name: "/评论|Comments/i",
        e2eSpec: E2E.adminModeration,
      },
    ],
  },
  {
    routeId: "/admin/oauth",
    samplePath: "/admin/oauth",
    kind: "page",
    auth: "admin",
    contractPath: "/admin/oauth",
    e2eSpec: E2E.adminOauth,
    mobileScreenshots: ["admin"],
    primaryActions: [
      {
        id: "create-client",
        role: "button",
        name: "/创建客户端|Create Client/i",
        e2eSpec: E2E.adminOauth,
      },
    ],
  },
  {
    routeId: "/admin/users",
    samplePath: "/admin/users",
    kind: "page",
    auth: "admin",
    contractPath: "/admin/users",
    e2eSpec: E2E.adminUsers,
    mobileScreenshots: ["admin"],
    primaryActions: [
      {
        id: "manage-user",
        role: "button",
        name: "/管理用户|Manage User/i",
        e2eSpec: E2E.adminUsers,
      },
    ],
  },
  {
    routeId: "/api/docs",
    samplePath: "/api/docs",
    kind: "redirect",
    auth: "public",
    contractPath: "/api/docs",
    e2eSpec: E2E.apiDocs,
  },
  {
    routeId: "/api/docs/[...path]",
    samplePath: "/api/docs/tag/catalog-section",
    kind: "page",
    auth: "public",
    contractPath: "/api/docs/tag/catalog-section",
    e2eSpec: E2E.apiDocs,
    mobileCoveredBy: {
      e2eSpec: E2E.apiDocs,
      testName: "移动端优先展示参考内容并用抽屉浏览完整导航",
      reason:
        "The embedded API reference has a dedicated mobile navigation and focus contract.",
    },
    primaryActions: [
      {
        id: "scalar-nav",
        e2eSpec: E2E.apiDocs,
        evidence: "使用路径导航而非哈希导航",
      },
    ],
  },
  {
    routeId: "/catalog/bus",
    samplePath: "/catalog/bus",
    kind: "page",
    auth: "public",
    contractPath: "/catalog/bus",
    e2eSpec: E2E.bus,
    mobileScreenshots: ["public"],
    primaryActions: [
      {
        id: "change-route",
        role: "button",
        name: "/Change route|调整路线/",
        e2eSpec: E2E.bus,
      },
      {
        id: "full-timetable",
        role: "button",
        name: "/Full timetable|完整时刻表/",
        e2eSpec: E2E.bus,
      },
    ],
  },
  {
    routeId: "/catalog/bus/map",
    samplePath: "/catalog/bus/map",
    kind: "page",
    auth: "public",
    contractPath: "/catalog/bus/map",
    e2eSpec: E2E.busMap,
    mobileScreenshots: ["public"],
    primaryActions: [
      {
        id: "refresh-map",
        role: "button",
        name: "/Refresh|刷新/i",
        e2eSpec: E2E.busMap,
      },
    ],
  },
  {
    routeId: "/catalog/courses",
    samplePath: "/catalog/courses",
    kind: "page",
    auth: "public",
    contractPath: "/catalog/courses",
    e2eSpec: E2E.courses,
    mobileScreenshots: ["public"],
    primaryActions: [
      {
        id: "search-courses",
        e2eSpec: E2E.courses,
        evidence: "搜索和清除按钮",
      },
    ],
  },
  {
    routeId: "/catalog/courses/[jwId]",
    samplePath: `/catalog/courses/${DEV_SEED.course.jwId}`,
    kind: "page",
    auth: "public",
    contractPath: "/catalog/courses/[jwId]",
    e2eSpec: E2E.coursesJwId,
    mobileScreenshots: ["public"],
    primaryActions: [
      {
        id: "teaching-sections",
        e2eSpec: E2E.coursesJwId,
        evidence: "班级行链接到班级详情",
      },
    ],
  },
  {
    routeId: "/catalog/courses/[jwId]/[section]",
    samplePath: `/catalog/courses/${DEV_SEED.course.jwId}/introduction`,
    kind: "redirect",
    auth: "public",
    contractPath: "/catalog/courses/[jwId]/[section]",
    e2eSpec: E2E.coursesJwId,
  },
  {
    routeId: "/catalog/links",
    samplePath: "/catalog/links",
    kind: "page",
    auth: "public",
    contractPath: "/catalog/links",
    e2eSpec: E2E.dashboardLinks,
    mobileScreenshots: ["public", "authed"],
    primaryActions: [
      {
        id: "search-links",
        role: "searchbox",
        name: "/搜索网站名称、描述或域名|Search by name, description, or domain/i",
        e2eSpec: E2E.dashboardLinks,
      },
      {
        id: "pin-link",
        role: "button",
        name: "/^(?:置顶|Pin)$/i",
        e2eSpec: E2E.dashboardLinks,
      },
    ],
  },
  {
    routeId: "/catalog/sections",
    samplePath: "/catalog/sections",
    kind: "page",
    auth: "public",
    contractPath: "/catalog/sections",
    e2eSpec: E2E.sections,
    mobileScreenshots: ["public"],
    primaryActions: [
      {
        id: "search-sections",
        e2eSpec: E2E.sections,
        evidence: "结构化筛选、高级语法与清除",
      },
    ],
  },
  {
    routeId: "/catalog/sections/[jwId]",
    samplePath: `/catalog/sections/${DEV_SEED.section.jwId}`,
    kind: "page",
    auth: "public",
    contractPath: "/catalog/sections/[jwId]",
    e2eSpec: E2E.sectionsJwId,
    mobileScreenshots: ["public"],
    primaryActions: [
      {
        id: "subscribe",
        role: "button",
        name: "/订阅教学班|Subscribe to section/i",
        e2eSpec: E2E.sectionsJwId,
      },
      {
        id: "unsubscribe",
        role: "button",
        name: "/取消订阅|Unsubscribe from section/i",
        e2eSpec: E2E.sectionsJwId,
      },
      {
        id: "add-to-calendar",
        role: "button",
        name: "/添加到日历|Add to calendar/i",
        e2eSpec: E2E.sectionsJwId,
      },
    ],
  },
  {
    routeId: "/catalog/sections/[jwId]/[section]",
    samplePath: `/catalog/sections/${DEV_SEED.section.jwId}/introduction`,
    kind: "redirect",
    auth: "public",
    contractPath: "/catalog/sections/[jwId]/[section]",
    e2eSpec: E2E.sectionsJwId,
  },
  {
    routeId: "/catalog/teachers",
    samplePath: "/catalog/teachers",
    kind: "page",
    auth: "public",
    contractPath: "/catalog/teachers",
    e2eSpec: E2E.teachers,
    mobileScreenshots: ["public"],
    primaryActions: [
      {
        id: "search-teachers",
        e2eSpec: E2E.teachers,
        evidence: "搜索和清除按钮可用",
      },
    ],
  },
  {
    routeId: "/catalog/teachers/[id]",
    samplePath: "/catalog/teachers/[id]",
    kind: "page",
    auth: "public",
    contractPath: "/catalog/teachers/[id]",
    e2eSpec: E2E.teachersId,
    mobileCoveredBy: {
      e2eSpec: E2E.teachersId,
      testName: "移动端教师标题与流式区块保持紧凑",
      reason:
        "The stable teacher URL is discovered from seeded search results before checking the mobile layout.",
    },
    primaryActions: [
      {
        id: "teaching-sections",
        e2eSpec: E2E.teachersId,
        evidence: "班级链接导航到班级详情",
      },
    ],
  },
  {
    routeId: "/catalog/teachers/[id]/[section]",
    samplePath: "/catalog/teachers/[id]/introduction",
    kind: "redirect",
    auth: "public",
    contractPath: "/catalog/teachers/[id]/[section]",
    e2eSpec: E2E.teachersId,
  },
  {
    routeId: "/community/comments/[id]",
    samplePath: "/community/comments/[id]",
    kind: "redirect",
    auth: "public",
    contractPath: "/community/comments/[id]",
    e2eSpec: E2E.commentsId,
  },
  {
    routeId: "/community/comments/guide",
    samplePath: "/community/comments/guide",
    kind: "redirect",
    auth: "public",
    contractPath: "/community/comments/guide",
    e2eSpec: E2E.commentsGuide,
    mobileScreenshots: ["public"],
  },
  {
    routeId: "/community/users/[identifier]",
    samplePath: `/community/users/${DEV_SEED.debugUsername}`,
    kind: "page",
    auth: "public",
    contractPath: "/community/users/[identifier]",
    e2eSpec: E2E.communityUser,
    mobileScreenshots: ["public", "authed"],
    primaryActions: [
      {
        id: "profile-identity",
        exemption: "decorative",
      },
    ],
  },
  {
    routeId: "/e2e/oauth/callback",
    samplePath: "/e2e/oauth/callback?code=e2e-test-code&state=e2e-test-state",
    kind: "page",
    auth: "public",
    contractPath: "/e2e/oauth/callback",
    e2eSpec: E2E.e2eOauthCallback,
    mobileScreenshots: ["public"],
    primaryActions: [
      {
        id: "callback-payload",
        exemption: "decorative",
      },
    ],
  },
  {
    routeId: "/error",
    samplePath: "/error?error=consent_failed",
    kind: "page",
    auth: "public",
    contractPath: "/error",
    e2eSpec: E2E.error,
    mobileScreenshots: ["public"],
    primaryActions: [
      {
        id: "return-home",
        role: "link",
        name: "/返回首页|Return home/i",
        e2eSpec: E2E.error,
      },
    ],
  },
  {
    routeId: "/guides/markdown-support",
    samplePath: "/guides/markdown-support",
    kind: "page",
    auth: "public",
    contractPath: "/guides/markdown-support",
    e2eSpec: E2E.guidesMarkdown,
    mobileScreenshots: ["public"],
    primaryActions: [
      {
        id: "markdown-preview",
        exemption: "decorative",
      },
    ],
  },
  {
    routeId: "/usage/mobile",
    samplePath: "/usage/mobile",
    kind: "page",
    auth: "public",
    contractPath: "/usage/mobile",
    e2eSpec: E2E.usage,
    mobileScreenshots: ["public"],
    primaryActions: [
      {
        id: "app-store",
        role: "link",
        name: "/App Store|下载/i",
        e2eSpec: E2E.usage,
      },
    ],
  },
  {
    routeId: "/usage/bot",
    samplePath: "/usage/bot",
    kind: "page",
    auth: "public",
    contractPath: "/usage/bot",
    e2eSpec: E2E.usage,
    mobileScreenshots: ["public"],
    primaryActions: [
      {
        id: "open-presto-qq",
        role: "link",
        name: "/Presto/i",
        e2eSpec: E2E.usage,
      },
    ],
  },
  {
    routeId: "/usage/mcp",
    samplePath: "/usage/mcp",
    kind: "page",
    auth: "public",
    contractPath: "/usage/mcp",
    e2eSpec: E2E.usage,
    mobileScreenshots: ["public"],
    primaryActions: [
      {
        id: "copy-mcp-endpoint",
        role: "button",
        name: "/MCP endpoint|MCP 端点/i",
        e2eSpec: E2E.usage,
      },
    ],
  },
  {
    routeId: "/usage/cli",
    samplePath: "/usage/cli",
    kind: "page",
    auth: "public",
    contractPath: "/usage/cli",
    e2eSpec: E2E.usage,
    mobileScreenshots: ["public"],
    primaryActions: [
      {
        id: "download-cli",
        role: "link",
        name: "/Releases/i",
        e2eSpec: E2E.usage,
      },
    ],
  },
  {
    routeId: "/oauth/authorize",
    samplePath: "/oauth/authorize",
    kind: "page",
    auth: "public",
    contractPath: "/oauth/authorize",
    e2eSpec: E2E.oauthAuthorize,
    mobileScreenshots: ["public"],
    primaryActions: [
      {
        id: "authorize-flow",
        e2eSpec: E2E.oauthAuthorize,
        evidence: "允许授权时带 code 回跳",
      },
    ],
  },
  {
    routeId: "/oauth/device",
    samplePath: "/oauth/device",
    kind: "page",
    auth: "public",
    contractPath: "/oauth/device",
    e2eSpec: E2E.oauthDevice,
    mobileScreenshots: ["public"],
    primaryActions: [
      {
        id: "device-code",
        e2eSpec: E2E.oauthDevice,
        evidence: "已登录用户看到批准界面",
      },
    ],
  },
  {
    routeId: "/privacy",
    samplePath: "/privacy",
    kind: "page",
    auth: "public",
    contractPath: "/privacy",
    e2eSpec: E2E.privacy,
    mobileScreenshots: ["public"],
    primaryActions: [
      {
        id: "policy-body",
        exemption: "decorative",
      },
    ],
  },
  {
    routeId: "/search",
    samplePath: "/search",
    kind: "page",
    auth: "public",
    contractPath: "/search",
    e2eSpec: E2E.search,
    mobileScreenshots: ["public"],
    primaryActions: [
      {
        id: "search-input",
        role: "combobox",
        e2eSpec: E2E.search,
      },
      {
        id: "keyboard-nav",
        e2eSpec: E2E.search,
        evidence: "search page supports keyboard navigation into results",
      },
    ],
  },
  {
    routeId: "/terms",
    samplePath: "/terms",
    kind: "page",
    auth: "public",
    contractPath: "/terms",
    e2eSpec: E2E.terms,
    mobileScreenshots: ["public"],
    primaryActions: [
      {
        id: "terms-body",
        exemption: "decorative",
      },
    ],
  },
  {
    routeId: "/workspace",
    samplePath: "/workspace",
    kind: "redirect",
    auth: "user",
    contractPath: "/workspace",
    e2eSpec: E2E.dashboardTab,
  },
  {
    routeId: "/workspace/[tab]",
    samplePath: "/workspace/overview",
    kind: "page",
    auth: "user",
    contractPath: "/workspace/overview",
    e2eSpec: E2E.dashboardTab,
    mobileScreenshots: ["authed"],
    primaryActions: [
      ...workspaceTabIds.map(
        (tab): PrimaryAction => ({
          id: `workspace-tab-${tab}`,
          role: "link",
          e2eSpec: E2E.dashboardTab,
          evidence: "登录工作台各分支提供唯一页面身份",
        }),
      ),
      {
        id: "overview-now-next",
        e2eSpec: E2E.dashboard,
        evidence: "移动端总览优先显示此刻与下一步",
      },
      {
        id: "calendar-export",
        e2eSpec: E2E.dashboardCalendar,
        evidence: "复制日历链接生成有效的 iCal URL",
      },
      {
        id: "homework-crud",
        e2eSpec: E2E.dashboardHomeworks,
        evidence: "可以创建新作业",
      },
      {
        id: "todo-crud",
        e2eSpec: E2E.dashboardTodos,
        evidence: "可以创建、编辑和删除待办",
      },
      {
        id: "exams-view",
        e2eSpec: E2E.dashboardExams,
        evidence: "考试列表显示必填字段",
      },
      {
        id: "subscriptions-bulk-import",
        e2eSpec: E2E.dashboardSubscriptions,
        evidence: "批量导入可确认并显示成功",
      },
    ],
  },
  {
    routeId: "/workspace/subscriptions",
    samplePath: "/workspace/subscriptions",
    kind: "page",
    auth: "user",
    contractPath: "/workspace/subscriptions",
    e2eSpec: E2E.dashboardSubscriptions,
    mobileScreenshots: ["authed"],
    primaryActions: [
      {
        id: "bulk-import",
        e2eSpec: E2E.dashboardSubscriptions,
        evidence: "批量导入打开确认对话框并可取消",
      },
      {
        id: "unsubscribe-row",
        e2eSpec: E2E.dashboardSubscriptions,
        evidence: "取消订阅操作确认后移除订阅",
      },
      {
        id: "calendar-feed-copy",
        e2eSpec: E2E.dashboardSubscriptions,
        evidence: "复制日历链接生成有效的 iCal URL",
      },
    ],
  },
  {
    routeId: "/workspace/subscriptions/sections",
    samplePath: "/workspace/subscriptions/sections",
    kind: "redirect",
    auth: "user",
    contractPath: "/workspace/subscriptions/sections",
    e2eSpec: E2E.dashboardSubscriptions,
  },
] as const satisfies readonly PageInventoryEntry[];

export function inventoryByRouteId(
  routeId: string,
): PageInventoryEntry | undefined {
  return PAGE_INVENTORY.find((entry) => entry.routeId === routeId);
}

export function mobileScreenshotPaths(group: MobileScreenshotGroup): string[] {
  const paths = PAGE_INVENTORY.filter((entry) =>
    entry.mobileScreenshots?.includes(group),
  ).map((entry) => entry.samplePath);

  if (group === "authed") {
    for (const tab of workspaceTabIds) {
      const path = `/workspace/${tab}`;
      if (!paths.includes(path)) {
        paths.push(path);
      }
    }
    for (const tab of SETTINGS_TABS) {
      const path = `/account/settings/${tab}`;
      if (!paths.includes(path)) {
        paths.push(path);
      }
    }
  }

  return paths;
}

/** Map src/routes/.../+page.svelte relative path to SvelteKit route id. */
export function routeIdFromPageFile(relativeFromRoutes: string): string {
  const withoutPage = relativeFromRoutes.replace(/\/?\+page\.svelte$/, "");
  if (!withoutPage || withoutPage === ".") {
    return "/";
  }
  return `/${withoutPage}`;
}
