import { describe, expect, it } from "vitest";
import { dashboardRedirectHrefFromHome } from "@/features/dashboard/lib/dashboard-nav";

describe("dashboardRedirectHrefFromHome", () => {
  it("preserves supported dashboard state and drops unrelated query values", () => {
    const url = new URL(
      "https://example.test/?tab=calendar&calendarView=week&calendarSemester=42&utm_source=ignored",
    );

    expect(dashboardRedirectHrefFromHome(url)).toBe(
      "/dashboard?tab=calendar&calendarView=week&calendarSemester=42",
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
