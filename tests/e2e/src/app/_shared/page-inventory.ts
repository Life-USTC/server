/** Browser route samples and mobile batches. Behavioral coverage is reviewed manually. */

import { SETTINGS_TABS } from "@/features/settings/lib/settings-tabs";
import { workspaceTabIds } from "@/features/workspace/lib/workspace-nav";
import { DEV_SEED } from "../../../../fixtures/dev-seed";

export type PageAuth = "public" | "user" | "admin";
export type PageKind = "page" | "redirect";
export type MobileScreenshotGroup = "public" | "authed" | "admin";
export type PageInventoryEntry = {
  routeId: string;
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
export const PAGE_INVENTORY: readonly PageInventoryEntry[] = [
  {
    routeId: "/",
    samplePath: "/",
    kind: "page",
    auth: "public",
    mobileScreenshots: ["public"],
  },
  {
    routeId: "/account/settings",
    samplePath: "/account/settings",
    kind: "redirect",
    auth: "user",
  },
  {
    routeId: "/account/settings/[tab]",
    samplePath: "/account/settings/profile",
    kind: "page",
    auth: "user",
    mobileScreenshots: ["authed"],
  },
  {
    routeId: "/account/sign-in",
    samplePath: "/account/sign-in",
    kind: "page",
    auth: "public",
    mobileScreenshots: ["public"],
  },
  {
    routeId: "/account/welcome",
    samplePath: "/account/welcome",
    kind: "page",
    auth: "user",
  },
  {
    routeId: "/admin",
    samplePath: "/admin",
    kind: "redirect",
    auth: "admin",
  },
  {
    routeId: "/admin/bus",
    samplePath: "/admin/bus",
    kind: "page",
    auth: "admin",
    mobileScreenshots: ["admin"],
  },
  {
    routeId: "/admin/moderation",
    samplePath: "/admin/moderation",
    kind: "page",
    auth: "admin",
    mobileScreenshots: ["admin"],
  },
  {
    routeId: "/admin/oauth",
    samplePath: "/admin/oauth",
    kind: "page",
    auth: "admin",
    mobileScreenshots: ["admin"],
  },
  {
    routeId: "/admin/users",
    samplePath: "/admin/users",
    kind: "page",
    auth: "admin",
    mobileScreenshots: ["admin"],
  },
  {
    routeId: "/api/docs",
    samplePath: "/api/docs",
    kind: "redirect",
    auth: "public",
  },
  {
    routeId: "/api/docs/[...path]",
    samplePath: "/api/docs/tag/catalog-section",
    kind: "page",
    auth: "public",
  },
  {
    routeId: "/catalog/bus",
    samplePath: "/catalog/bus",
    kind: "page",
    auth: "public",
    mobileScreenshots: ["public"],
  },
  {
    routeId: "/catalog/bus/map",
    samplePath: "/catalog/bus/map",
    kind: "page",
    auth: "public",
    mobileScreenshots: ["public"],
  },
  {
    routeId: "/catalog/courses",
    samplePath: "/catalog/courses",
    kind: "page",
    auth: "public",
    mobileScreenshots: ["public"],
  },
  {
    routeId: "/catalog/rooms",
    samplePath: "/catalog/rooms",
    kind: "page",
    auth: "public",
    mobileScreenshots: ["public"],
  },
  {
    routeId: "/catalog/weather",
    samplePath: "/catalog/weather",
    kind: "page",
    auth: "public",
    mobileScreenshots: ["public"],
  },
  {
    routeId: "/catalog/young-events",
    samplePath: "/catalog/young-events",
    kind: "page",
    auth: "public",
    mobileScreenshots: ["public"],
  },
  {
    routeId: "/catalog/young-events/[youngId]",
    samplePath: `/catalog/young-events/${DEV_SEED.youngEvent.youngId}`,
    kind: "page",
    auth: "public",
    mobileScreenshots: ["public"],
  },
  {
    routeId: "/catalog/young-events/calendar",
    samplePath: "/catalog/young-events/calendar",
    kind: "page",
    auth: "public",
    mobileScreenshots: ["public"],
  },
  {
    routeId: "/catalog/young-events/organizers",
    samplePath: "/catalog/young-events/organizers",
    kind: "page",
    auth: "public",
    mobileScreenshots: ["public"],
  },
  {
    routeId: "/catalog/young-events/organizers/[organizerId]",
    samplePath: "/catalog/young-events/organizers/dev-scenario-young-organizer",
    kind: "page",
    auth: "public",
    mobileScreenshots: ["public"],
  },
  {
    routeId: "/catalog/courses/[jwId]",
    samplePath: `/catalog/courses/${DEV_SEED.course.jwId}`,
    kind: "page",
    auth: "public",
    mobileScreenshots: ["public"],
  },
  {
    routeId: "/catalog/courses/[jwId]/[section]",
    samplePath: `/catalog/courses/${DEV_SEED.course.jwId}/introduction`,
    kind: "redirect",
    auth: "public",
  },
  {
    routeId: "/catalog/links",
    samplePath: "/catalog/links",
    kind: "page",
    auth: "public",
    mobileScreenshots: ["public", "authed"],
  },
  {
    routeId: "/catalog/sections",
    samplePath: "/catalog/sections",
    kind: "page",
    auth: "public",
    mobileScreenshots: ["public"],
  },
  {
    routeId: "/catalog/sections/[jwId]",
    samplePath: `/catalog/sections/${DEV_SEED.section.jwId}`,
    kind: "page",
    auth: "public",
    mobileScreenshots: ["public"],
  },
  {
    routeId: "/catalog/sections/[jwId]/[section]",
    samplePath: `/catalog/sections/${DEV_SEED.section.jwId}/introduction`,
    kind: "redirect",
    auth: "public",
  },
  {
    routeId: "/catalog/teachers",
    samplePath: "/catalog/teachers",
    kind: "page",
    auth: "public",
    mobileScreenshots: ["public"],
  },
  {
    routeId: "/catalog/teachers/[id]",
    samplePath: "/catalog/teachers/[id]",
    kind: "page",
    auth: "public",
  },
  {
    routeId: "/catalog/teachers/[id]/[section]",
    samplePath: "/catalog/teachers/[id]/introduction",
    kind: "redirect",
    auth: "public",
  },
  {
    routeId: "/community/comments/[id]",
    samplePath: "/community/comments/[id]",
    kind: "redirect",
    auth: "public",
  },
  {
    routeId: "/community/comments/guide",
    samplePath: "/community/comments/guide",
    kind: "redirect",
    auth: "public",
    mobileScreenshots: ["public"],
  },
  {
    routeId: "/community/users/[identifier]",
    samplePath: `/community/users/${DEV_SEED.debugUsername}`,
    kind: "page",
    auth: "public",
    mobileScreenshots: ["public", "authed"],
  },
  {
    routeId: "/e2e/oauth/callback",
    samplePath: "/e2e/oauth/callback?code=e2e-test-code&state=e2e-test-state",
    kind: "page",
    auth: "public",
    mobileScreenshots: ["public"],
  },
  {
    routeId: "/error",
    samplePath: "/error?error=consent_failed",
    kind: "page",
    auth: "public",
    mobileScreenshots: ["public"],
  },
  {
    routeId: "/guides/markdown-support",
    samplePath: "/guides/markdown-support",
    kind: "page",
    auth: "public",
    mobileScreenshots: ["public"],
  },
  {
    routeId: "/usage/mobile",
    samplePath: "/usage/mobile",
    kind: "page",
    auth: "public",
    mobileScreenshots: ["public"],
  },
  {
    routeId: "/usage/bot",
    samplePath: "/usage/bot",
    kind: "page",
    auth: "public",
    mobileScreenshots: ["public"],
  },
  {
    routeId: "/usage/mcp",
    samplePath: "/usage/mcp",
    kind: "page",
    auth: "public",
    mobileScreenshots: ["public"],
  },
  {
    routeId: "/usage/cli",
    samplePath: "/usage/cli",
    kind: "page",
    auth: "public",
    mobileScreenshots: ["public"],
  },
  {
    routeId: "/oauth/authorize",
    samplePath: "/oauth/authorize",
    kind: "page",
    auth: "public",
    mobileScreenshots: ["public"],
  },
  {
    routeId: "/oauth/device",
    samplePath: "/oauth/device",
    kind: "page",
    auth: "public",
    mobileScreenshots: ["public"],
  },
  {
    routeId: "/news",
    samplePath: "/news",
    kind: "page",
    auth: "public",
    mobileScreenshots: ["public"],
  },
  {
    routeId: "/news/sources",
    samplePath: "/news/sources",
    kind: "page",
    auth: "public",
    mobileScreenshots: ["public"],
  },
  {
    routeId: "/news/[id]",
    samplePath: "/news/[id]",
    kind: "page",
    auth: "public",
  },
  {
    routeId: "/privacy",
    samplePath: "/privacy",
    kind: "page",
    auth: "public",
    mobileScreenshots: ["public"],
  },
  {
    routeId: "/search",
    samplePath: "/search",
    kind: "page",
    auth: "public",
    mobileScreenshots: ["public"],
  },
  {
    routeId: "/terms",
    samplePath: "/terms",
    kind: "page",
    auth: "public",
    mobileScreenshots: ["public"],
  },
  {
    routeId: "/workspace",
    samplePath: "/workspace",
    kind: "redirect",
    auth: "user",
  },
  {
    routeId: "/workspace/[tab]",
    samplePath: "/workspace/overview",
    kind: "page",
    auth: "user",
    mobileScreenshots: ["authed"],
  },
  {
    routeId: "/workspace/subscriptions",
    samplePath: "/workspace/subscriptions",
    kind: "page",
    auth: "user",
    mobileScreenshots: ["authed"],
  },
  {
    routeId: "/workspace/subscriptions/activities",
    samplePath: "/workspace/subscriptions/activities",
    kind: "page",
    auth: "user",
    mobileScreenshots: ["authed"],
  },
  {
    routeId: "/workspace/subscriptions/sections",
    samplePath: "/workspace/subscriptions/sections",
    kind: "redirect",
    auth: "user",
  },
  {
    routeId: "/workspace/uploads",
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
