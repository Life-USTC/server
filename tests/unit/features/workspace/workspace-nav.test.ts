import { describe, expect, it } from "vitest";
import {
  homeTabCompatibilityRedirectHref,
  isWorkspaceTab,
  WORKSPACE_SUBSCRIPTIONS_PATH,
  workspaceTabCompatibilityRedirectHref,
  workspaceTabHref,
} from "@/features/workspace/lib/workspace-nav";

describe("workspace dynamic tab allowlist", () => {
  it("treats subscriptions as a static route, not a [tab] param", () => {
    expect(isWorkspaceTab("subscriptions")).toBe(false);
    expect(workspaceTabHref("subscriptions")).toBe(
      WORKSPACE_SUBSCRIPTIONS_PATH,
    );
  });
});

describe("homeTabCompatibilityRedirectHref", () => {
  it("maps anonymous public tabs to semantic public routes", () => {
    const url = new URL(
      "https://example.test/?tab=links&linkView=list&utm_source=bookmark",
    );

    expect(homeTabCompatibilityRedirectHref(url)).toBe(
      "/catalog/links?linkView=list&utm_source=bookmark",
    );
  });

  it("maps public tabs to semantic public routes for every visitor alike", () => {
    const url = new URL("https://example.test/?tab=bus");

    expect(homeTabCompatibilityRedirectHref(url)).toBe("/catalog/bus");
  });

  it("maps authenticated-only tabs to their protected semantic routes", () => {
    const url = new URL(
      "https://example.test/?tab=homeworks&homeworkView=list",
    );

    expect(homeTabCompatibilityRedirectHref(url)).toBe(
      "/workspace/homeworks?homeworkView=list",
    );
  });

  it("maps legacy subscriptions tab queries to the static subscriptions route", () => {
    const url = new URL(
      "https://example.test/?tab=subscriptions&semester=2026-spring",
    );

    expect(homeTabCompatibilityRedirectHref(url)).toBe(
      `${WORKSPACE_SUBSCRIPTIONS_PATH}?semester=2026-spring`,
    );
  });

  it("ignores unknown tab values", () => {
    const url = new URL("https://example.test/?tab=unknown");

    expect(homeTabCompatibilityRedirectHref(url)).toBeNull();
  });
});

describe("workspaceTabCompatibilityRedirectHref", () => {
  it.each(["GET", "HEAD"])(
    "maps workspace query tabs to semantic child routes for %s",
    (method) => {
      const url = new URL(
        "https://example.test/workspace?tab=calendar&calendarView=week&utm_source=bookmark",
      );

      expect(workspaceTabCompatibilityRedirectHref(url, method)).toBe(
        "/workspace/calendar?calendarView=week&utm_source=bookmark",
      );
    },
  );

  it("maps legacy subscriptions tab queries to the static subscriptions route", () => {
    const url = new URL(
      "https://example.test/workspace?tab=subscriptions&utm_source=bookmark",
    );

    expect(workspaceTabCompatibilityRedirectHref(url)).toBe(
      `${WORKSPACE_SUBSCRIPTIONS_PATH}?utm_source=bookmark`,
    );
  });

  it("maps the workspace root and unknown tabs to overview", () => {
    expect(
      workspaceTabCompatibilityRedirectHref(
        new URL("https://example.test/workspace?overviewWeek=next"),
      ),
    ).toBe("/workspace/overview?overviewWeek=next");

    const url = new URL(
      "https://example.test/workspace?tab=unknown&todoView=list",
    );

    expect(workspaceTabCompatibilityRedirectHref(url)).toBe(
      "/workspace/overview?todoView=list",
    );
  });

  it("does not redirect mutations or semantic child routes", () => {
    expect(
      workspaceTabCompatibilityRedirectHref(
        new URL("https://example.test/workspace?tab=todos"),
        "POST",
      ),
    ).toBeNull();
    expect(
      workspaceTabCompatibilityRedirectHref(
        new URL("https://example.test/workspace/overview?tab=todos"),
        "GET",
      ),
    ).toBeNull();
  });
});
