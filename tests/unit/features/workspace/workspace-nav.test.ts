import { describe, expect, it } from "vitest";
import {
  homeTabCompatibilityRedirectHref,
  workspaceRedirectHrefFromHome,
  workspaceTabCompatibilityRedirectHref,
} from "@/features/workspace/lib/workspace-nav";

describe("workspaceRedirectHrefFromHome", () => {
  it("preserves supported workspace state and drops unrelated query values", () => {
    const url = new URL(
      "https://example.test/?tab=calendar&calendarView=week&calendarSemester=42&utm_source=ignored",
    );

    expect(workspaceRedirectHrefFromHome(url)).toBe(
      "/workspace/calendar?calendarView=week&calendarSemester=42",
    );
  });

  it("drops unsupported tab values while preserving supported view state", () => {
    const url = new URL(
      "https://example.test/?tab=unknown&homeworkView=completed&removed=3",
    );

    expect(workspaceRedirectHrefFromHome(url)).toBe(
      "/workspace/overview?homeworkView=completed",
    );
  });
});

describe("homeTabCompatibilityRedirectHref", () => {
  it("maps anonymous public tabs to semantic public routes", () => {
    const url = new URL(
      "https://example.test/?tab=links&linkView=list&utm_source=bookmark",
    );

    expect(homeTabCompatibilityRedirectHref(url, false)).toBe(
      "/catalog/links?linkView=list&utm_source=bookmark",
    );
  });

  it("maps signed-in public tabs to their workspace routes", () => {
    const url = new URL("https://example.test/?tab=bus");

    expect(homeTabCompatibilityRedirectHref(url, true)).toBe("/catalog/bus");
  });

  it("maps authenticated-only tabs to their protected semantic routes", () => {
    const url = new URL(
      "https://example.test/?tab=homeworks&homeworkView=list",
    );

    expect(homeTabCompatibilityRedirectHref(url, false)).toBe(
      "/workspace/homeworks?homeworkView=list",
    );
  });

  it("ignores unknown tab values", () => {
    const url = new URL("https://example.test/?tab=unknown");

    expect(homeTabCompatibilityRedirectHref(url, false)).toBeNull();
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
