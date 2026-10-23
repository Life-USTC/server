import { expect } from "@playwright/test";
import { test } from "../../../e2e/utils/owned-worker";

test("usage.mobile-app-association", { tag: "@Site/REST" }, async ({
  request,
  run,
}) => {
  await run(async () => {
    const response = await request.get(
      "/.well-known/apple-app-site-association",
      { maxRedirects: 0 },
    );
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("application/json");
    const association = await response.json();
    const details = association.applinks.details;
    expect(details).toHaveLength(1);
    expect(details[0].appIDs).toEqual(["VUW8FV5HN5.dev.tiankaima.Life-USTC"]);
    expect(association.webcredentials.apps).toEqual([
      "VUW8FV5HN5.dev.tiankaima.Life-USTC",
    ]);
    const components = details[0].components as {
      "/": string;
      exclude?: boolean;
    }[];
    const opensApp = (path: string) => {
      const component = components.find((item) =>
        new RegExp(`^${item["/"].replaceAll("*", ".*")}$`).test(path),
      );
      return Boolean(component && !component.exclude);
    };
    for (const path of [
      "/catalog/courses/1001",
      "/catalog/sections/42",
      "/catalog/teachers/3",
      "/catalog/young-events/event-1",
      "/catalog/young-events/organizers/organizer-1",
      "/community/comments/comment-1",
      "/community/users/student",
      "/news/publication-1",
      "/news/sources",
      "/workspace/calendar",
      "/workspace/todos",
      "/workspace/homeworks",
      "/workspace/exams",
    ]) {
      expect(opensApp(path), path).toBe(true);
    }
    for (const path of [
      "/api/auth/oauth2/authorize",
      "/account/settings/security",
      "/admin",
      "/search",
      "/usage/mobile",
      "/community/comments/guide",
      "/catalog/young-events/calendar",
      "/catalog/young-events/organizers",
      "/catalog/sections/42/comments",
      "/api/catalog/links/resolve",
    ]) {
      expect(opensApp(path), path).toBe(false);
    }
  });
});
