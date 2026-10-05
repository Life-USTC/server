/** Browser route samples and mobile batches. Behavioral coverage is reviewed manually. */

import { SETTINGS_TABS } from "@/features/settings/lib/settings-tabs";
import { workspaceTabIds } from "@/features/workspace/lib/workspace-nav";
import { DEV_SEED } from "../../../../fixtures/dev-seed";

export type PageAuth = "public" | "user" | "admin";
export type PageKind = "page" | "redirect";
export type MobileScreenshotGroup = "public" | "authed" | "admin";
export type PageInventoryEntry = {
  routeId: string;
  domain: string;
  samplePath: string;
  kind: PageKind;
  auth: PageAuth;
  /** Drive one or more authenticated-state mobile checks from the inventory. */
  mobileScreenshots?: readonly MobileScreenshotGroup[];
};
/**
 * Tab ids reused so settings / workspace inventory stays DRY with product code.
 * Exported for unit gate cross-checks.
 */
export const INVENTORY_SETTINGS_TABS = SETTINGS_TABS;
export const INVENTORY_WORKSPACE_TABS = workspaceTabIds;
export const WORKSPACE_TAB_DOMAINS = {
  overview: "Overview",
  calendar: "Calendar",
  homeworks: "Homework",
  todos: "Todo",
  exams: "Exam",
  subscriptions: "Subscription",
} as const satisfies Record<(typeof workspaceTabIds)[number], string>;
export const PAGE_INVENTORY: readonly PageInventoryEntry[] = [
  {
    routeId: "/",
    domain: "Site",
    samplePath: "/",
    kind: "page",
    auth: "public",
    mobileScreenshots: ["public"],
  },
  {
    routeId: "/account/settings",
    domain: "Account",
    samplePath: "/account/settings",
    kind: "redirect",
    auth: "user",
  },
  {
    routeId: "/account/settings/[tab]",
    domain: "Account",
    samplePath: "/account/settings/profile",
    kind: "page",
    auth: "user",
    mobileScreenshots: ["authed"],
  },
  {
    routeId: "/account/sign-in",
    domain: "Account",
    samplePath: "/account/sign-in",
    kind: "page",
    auth: "public",
    mobileScreenshots: ["public"],
  },
  {
    routeId: "/account/welcome",
    domain: "Account",
    samplePath: "/account/welcome",
    kind: "page",
    auth: "user",
  },
  {
    routeId: "/admin",
    domain: "Admin",
    samplePath: "/admin",
    kind: "redirect",
    auth: "admin",
  },
  {
    routeId: "/admin/bus",
    domain: "Bus",
    samplePath: "/admin/bus",
    kind: "page",
    auth: "admin",
    mobileScreenshots: ["admin"],
  },
  {
    routeId: "/admin/moderation",
    domain: "Admin",
    samplePath: "/admin/moderation",
    kind: "page",
    auth: "admin",
    mobileScreenshots: ["admin"],
  },
  {
    routeId: "/admin/oauth",
    domain: "OAuth",
    samplePath: "/admin/oauth",
    kind: "page",
    auth: "admin",
    mobileScreenshots: ["admin"],
  },
  {
    routeId: "/admin/users",
    domain: "User",
    samplePath: "/admin/users",
    kind: "page",
    auth: "admin",
    mobileScreenshots: ["admin"],
  },
  {
    routeId: "/api/docs",
    domain: "OpenAPI",
    samplePath: "/api/docs",
    kind: "redirect",
    auth: "public",
  },
  {
    routeId: "/api/docs/[...path]",
    domain: "OpenAPI",
    samplePath: "/api/docs/tag/catalog-section",
    kind: "page",
    auth: "public",
  },
  {
    routeId: "/catalog/bus",
    domain: "Bus",
    samplePath: "/catalog/bus",
    kind: "page",
    auth: "public",
    mobileScreenshots: ["public"],
  },
  {
    routeId: "/catalog/bus/map",
    domain: "Bus",
    samplePath: "/catalog/bus/map",
    kind: "page",
    auth: "public",
    mobileScreenshots: ["public"],
  },
  {
    routeId: "/catalog/courses",
    domain: "Course",
    samplePath: "/catalog/courses",
    kind: "page",
    auth: "public",
    mobileScreenshots: ["public"],
  },
  {
    routeId: "/catalog/rooms",
    domain: "RoomMap",
    samplePath: "/catalog/rooms",
    kind: "page",
    auth: "public",
    mobileScreenshots: ["public"],
  },
  {
    routeId: "/catalog/weather",
    domain: "Weather",
    samplePath: "/catalog/weather",
    kind: "page",
    auth: "public",
    mobileScreenshots: ["public"],
  },
  {
    routeId: "/catalog/young-events",
    domain: "Young",
    samplePath: "/catalog/young-events",
    kind: "page",
    auth: "public",
    mobileScreenshots: ["public"],
  },
  {
    routeId: "/catalog/young-events/[youngId]",
    domain: "Young",
    samplePath: `/catalog/young-events/${DEV_SEED.youngEvent.youngId}`,
    kind: "page",
    auth: "public",
    mobileScreenshots: ["public"],
  },
  {
    routeId: "/catalog/young-events/calendar",
    domain: "Young",
    samplePath: "/catalog/young-events/calendar",
    kind: "page",
    auth: "public",
    mobileScreenshots: ["public"],
  },
  {
    routeId: "/catalog/young-events/organizers",
    domain: "Young",
    samplePath: "/catalog/young-events/organizers",
    kind: "page",
    auth: "public",
    mobileScreenshots: ["public"],
  },
  {
    routeId: "/catalog/young-events/organizers/[organizerId]",
    domain: "Young",
    samplePath: "/catalog/young-events/organizers/dev-scenario-young-organizer",
    kind: "page",
    auth: "public",
    mobileScreenshots: ["public"],
  },
  {
    routeId: "/catalog/courses/[jwId]",
    domain: "Course",
    samplePath: `/catalog/courses/${DEV_SEED.course.jwId}`,
    kind: "page",
    auth: "public",
    mobileScreenshots: ["public"],
  },
  {
    routeId: "/catalog/courses/[jwId]/[section]",
    domain: "Course",
    samplePath: `/catalog/courses/${DEV_SEED.course.jwId}/introduction`,
    kind: "redirect",
    auth: "public",
  },
  {
    routeId: "/catalog/links",
    domain: "CatalogLink",
    samplePath: "/catalog/links",
    kind: "page",
    auth: "public",
    mobileScreenshots: ["public", "authed"],
  },
  {
    routeId: "/catalog/sections",
    domain: "Section",
    samplePath: "/catalog/sections",
    kind: "page",
    auth: "public",
    mobileScreenshots: ["public"],
  },
  {
    routeId: "/catalog/sections/[jwId]",
    domain: "Section",
    samplePath: `/catalog/sections/${DEV_SEED.section.jwId}`,
    kind: "page",
    auth: "public",
    mobileScreenshots: ["public"],
  },
  {
    routeId: "/catalog/sections/[jwId]/[section]",
    domain: "Section",
    samplePath: `/catalog/sections/${DEV_SEED.section.jwId}/introduction`,
    kind: "redirect",
    auth: "public",
  },
  {
    routeId: "/catalog/teachers",
    domain: "Teacher",
    samplePath: "/catalog/teachers",
    kind: "page",
    auth: "public",
    mobileScreenshots: ["public"],
  },
  {
    routeId: "/catalog/teachers/[id]",
    domain: "Teacher",
    samplePath: "/catalog/teachers/[id]",
    kind: "page",
    auth: "public",
  },
  {
    routeId: "/catalog/teachers/[id]/[section]",
    domain: "Teacher",
    samplePath: "/catalog/teachers/[id]/introduction",
    kind: "redirect",
    auth: "public",
  },
  {
    routeId: "/community/comments/[id]",
    domain: "Comment",
    samplePath: "/community/comments/[id]",
    kind: "redirect",
    auth: "public",
  },
  {
    routeId: "/community/comments/guide",
    domain: "Comment",
    samplePath: "/community/comments/guide",
    kind: "redirect",
    auth: "public",
    mobileScreenshots: ["public"],
  },
  {
    routeId: "/community/users/[identifier]",
    domain: "User",
    samplePath: `/community/users/${DEV_SEED.debugUsername}`,
    kind: "page",
    auth: "public",
    mobileScreenshots: ["public", "authed"],
  },
  {
    routeId: "/e2e/oauth/callback",
    domain: "OAuth",
    samplePath: "/e2e/oauth/callback?code=e2e-test-code&state=e2e-test-state",
    kind: "page",
    auth: "public",
    mobileScreenshots: ["public"],
  },
  {
    routeId: "/error",
    domain: "Site",
    samplePath: "/error?error=consent_failed",
    kind: "page",
    auth: "public",
    mobileScreenshots: ["public"],
  },
  {
    routeId: "/guides/markdown-support",
    domain: "Site",
    samplePath: "/guides/markdown-support",
    kind: "page",
    auth: "public",
    mobileScreenshots: ["public"],
  },
  {
    routeId: "/usage/mobile",
    domain: "Site",
    samplePath: "/usage/mobile",
    kind: "page",
    auth: "public",
    mobileScreenshots: ["public"],
  },
  {
    routeId: "/usage/bot",
    domain: "Site",
    samplePath: "/usage/bot",
    kind: "page",
    auth: "public",
    mobileScreenshots: ["public"],
  },
  {
    routeId: "/usage/mcp",
    domain: "Site",
    samplePath: "/usage/mcp",
    kind: "page",
    auth: "public",
    mobileScreenshots: ["public"],
  },
  {
    routeId: "/usage/cli",
    domain: "Site",
    samplePath: "/usage/cli",
    kind: "page",
    auth: "public",
    mobileScreenshots: ["public"],
  },
  {
    routeId: "/oauth/authorize",
    domain: "OAuth",
    samplePath: "/oauth/authorize",
    kind: "page",
    auth: "public",
    mobileScreenshots: ["public"],
  },
  {
    routeId: "/oauth/device",
    domain: "OAuth",
    samplePath: "/oauth/device",
    kind: "page",
    auth: "public",
    mobileScreenshots: ["public"],
  },
  {
    routeId: "/news",
    domain: "Publication",
    samplePath: "/news",
    kind: "page",
    auth: "public",
    mobileScreenshots: ["public"],
  },
  {
    routeId: "/news/sources",
    domain: "Publication",
    samplePath: "/news/sources",
    kind: "page",
    auth: "public",
    mobileScreenshots: ["public"],
  },
  {
    routeId: "/news/[id]",
    domain: "Publication",
    samplePath: "/news/[id]",
    kind: "page",
    auth: "public",
  },
  {
    routeId: "/privacy",
    domain: "Site",
    samplePath: "/privacy",
    kind: "page",
    auth: "public",
    mobileScreenshots: ["public"],
  },
  {
    routeId: "/search",
    domain: "Search",
    samplePath: "/search",
    kind: "page",
    auth: "public",
    mobileScreenshots: ["public"],
  },
  {
    routeId: "/terms",
    domain: "Site",
    samplePath: "/terms",
    kind: "page",
    auth: "public",
    mobileScreenshots: ["public"],
  },
  {
    routeId: "/workspace",
    domain: "Overview",
    samplePath: "/workspace",
    kind: "redirect",
    auth: "user",
  },
  {
    routeId: "/workspace/[tab]",
    domain: "Overview",
    samplePath: "/workspace/overview",
    kind: "page",
    auth: "user",
    mobileScreenshots: ["authed"],
  },
  {
    routeId: "/workspace/subscriptions",
    domain: "Subscription",
    samplePath: "/workspace/subscriptions",
    kind: "page",
    auth: "user",
    mobileScreenshots: ["authed"],
  },
  {
    routeId: "/workspace/subscriptions/activities",
    domain: "Young",
    samplePath: "/workspace/subscriptions/activities",
    kind: "page",
    auth: "user",
    mobileScreenshots: ["authed"],
  },
  {
    routeId: "/workspace/subscriptions/sections",
    domain: "Subscription",
    samplePath: "/workspace/subscriptions/sections",
    kind: "redirect",
    auth: "user",
  },
  {
    routeId: "/workspace/uploads",
    domain: "Upload",
    samplePath: "/workspace/uploads",
    kind: "page",
    auth: "user",
  },
] as const satisfies readonly PageInventoryEntry[];

export function inventoryByRouteId(
  routeId: string,
): PageInventoryEntry | undefined {
  return PAGE_INVENTORY.find((entry) => entry.routeId === routeId);
}

export function mobileScreenshotCases(
  group: MobileScreenshotGroup,
): { path: string; domain: string }[] {
  const paths = PAGE_INVENTORY.filter((entry) =>
    entry.mobileScreenshots?.includes(group),
  ).map((entry) => ({ path: entry.samplePath, domain: entry.domain }));

  if (group === "authed") {
    for (const tab of workspaceTabIds) {
      const path = `/workspace/${tab}`;
      if (!paths.some((entry) => entry.path === path)) {
        paths.push({ path, domain: WORKSPACE_TAB_DOMAINS[tab] });
      }
    }
    for (const tab of SETTINGS_TABS) {
      const path = `/account/settings/${tab}`;
      if (!paths.some((entry) => entry.path === path)) {
        paths.push({ path, domain: "Account" });
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
