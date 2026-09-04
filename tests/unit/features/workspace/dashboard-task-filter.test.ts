import { describe, expect, test } from "vitest";
import { resolveDashboardTaskFilter } from "@/features/workspace/lib/dashboard-task-filter";

describe("resolveDashboardTaskFilter", () => {
  test("keeps incomplete when incomplete items exist", () => {
    expect(resolveDashboardTaskFilter("incomplete", true)).toBe("incomplete");
  });

  test("falls back to all when incomplete is empty", () => {
    expect(resolveDashboardTaskFilter("incomplete", false)).toBe("all");
  });

  test("does not change completed or all", () => {
    expect(resolveDashboardTaskFilter("completed", false)).toBe("completed");
    expect(resolveDashboardTaskFilter("all", false)).toBe("all");
    expect(resolveDashboardTaskFilter("completed", true)).toBe("completed");
  });
});
