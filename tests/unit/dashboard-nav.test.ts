import { describe, expect, it } from "vitest";
import {
  dashboardRedirectHrefFromHome,
  dashboardTabCompatibilityRedirectHref,
  homeTabCompatibilityRedirectHref,
} from "@/features/dashboard/lib/dashboard-nav";

describe("dashboardRedirectHrefFromHome", () => {
  it("preserves supported dashboard state and drops unrelated query values", () => {
    const url = new URL(
      "https://example.test/?tab=calendar&calendarView=week&calendarSemester=42&utm_source=ignored",
    );

    expect(dashboardRedirectHrefFromHome(url)).toBe(
      "/dashboard/calendar?calendarView=week&calendarSemester=42",
    );
  });

  it("drops unsupported tab values while preserving supported view state", () => {
    const url = new URL(
      "https://example.test/?tab=unknown&homeworkView=completed&removed=3",
    );

    expect(dashboardRedirectHrefFromHome(url)).toBe(
      "/dashboard?homeworkView=completed&removed=3",
    );
  });
});

describe("homeTabCompatibilityRedirectHref", () => {
  it("maps anonymous public tabs to semantic public routes", () => {
    const url = new URL(
      "https://example.test/?tab=links&linkView=list&utm_source=bookmark",
    );

    expect(homeTabCompatibilityRedirectHref(url, false)).toBe(
      "/links?linkView=list&utm_source=bookmark",
    );
  });

  it("maps signed-in public tabs to their workspace routes", () => {
    const url = new URL("https://example.test/?tab=bus");

    expect(homeTabCompatibilityRedirectHref(url, true)).toBe("/dashboard/bus");
  });

  it("maps authenticated-only tabs to their protected semantic routes", () => {
    const url = new URL(
      "https://example.test/?tab=homeworks&homeworkView=list",
    );

    expect(homeTabCompatibilityRedirectHref(url, false)).toBe(
      "/dashboard/homeworks?homeworkView=list",
    );
  });

  it("ignores unknown tab values", () => {
    const url = new URL("https://example.test/?tab=unknown");

    expect(homeTabCompatibilityRedirectHref(url, false)).toBeNull();
  });
});

describe("dashboardTabCompatibilityRedirectHref", () => {
  it("maps dashboard query tabs to semantic child routes", () => {
    const url = new URL(
      "https://example.test/dashboard?tab=calendar&calendarView=week",
    );

    expect(dashboardTabCompatibilityRedirectHref(url)).toBe(
      "/dashboard/calendar?calendarView=week",
    );
  });
});
