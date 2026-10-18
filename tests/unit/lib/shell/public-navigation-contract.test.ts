import { expect, test } from "vitest";
import { isPublicNavigationPath } from "@/lib/shell/public-navigation-contract";

test("rendering-and-cache.cacheable-public-pages-15 allowlist", () => {
  for (const path of [
    "/catalog/courses",
    "/catalog/sections",
    "/catalog/teachers",
    "/catalog/links",
    "/catalog/rooms",
    "/search",
    "/news",
    "/news/sources",
    "/privacy",
    "/terms",
    "/guides/markdown-support",
    "/api-docs",
    "/api/docs",
    "/usage/mobile",
    "/usage/bot",
    "/usage/mcp",
    "/usage/cli",
    "/community/comments/guide",
    "/catalog/courses/12",
    "/catalog/sections/12",
    "/catalog/teachers/3",
    "/catalog/young-events",
    "/catalog/young-events/calendar",
    "/catalog/young-events/organizers/club",
    "/news/story",
    "/community/users/public-user",
    "/api/docs/rest",
  ]) {
    expect(isPublicNavigationPath(path), path).toBe(true);
  }
  expect(isPublicNavigationPath("/news/story/")).toBe(true);
});

test.each([
  "/workspace/overview",
  "/account/profile",
  "/community/private",
  "/community/comments",
  "/community/users/alice/extra",
  "/catalog/bus",
  "/catalog/weather",
  "/catalog/young-events-private",
  "/usage/private",
  "/usage/unknown",
  "/",
  "/__data.json",
  "/catalog/courses/0",
  "/catalog/courses/012",
  "/news/story/extra",
])("rejects non-public navigation paths: %s", (path) => {
  expect(isPublicNavigationPath(path)).toBe(false);
});

test.each([
  "/workspace//overview",
  "/news/%2fworkspace",
  "/catalog//courses",
  "/community/users/%2e%2e/admin",
  "/catalog/courses/12%2f../workspace",
  "/news/%2Fworkspace",
  "/news/%5cworkspace",
  "/news/..",
  "/news/%2e",
  "/news/%2e%2e",
  "/news/%",
  "/news/%ff",
  "/news/story?query=1",
  "/news/story#fragment",
  "/api/docs/../private",
  "/api/docs/%2e%2e/private",
  "/api/docs//private",
  "news/story",
])("rejects encoded or ambiguous path bypasses: %s", (path) => {
  expect(isPublicNavigationPath(path)).toBe(false);
});
