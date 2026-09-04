import { describe, expect, test } from "vitest";
import { resolveWorkspaceTaskFilter } from "@/features/workspace/lib/workspace-task-filter";

describe("resolveWorkspaceTaskFilter", () => {
  test("keeps incomplete when incomplete items exist", () => {
    expect(resolveWorkspaceTaskFilter("incomplete", true)).toBe("incomplete");
  });

  test("falls back to all when incomplete is empty", () => {
    expect(resolveWorkspaceTaskFilter("incomplete", false)).toBe("all");
  });

  test("does not change completed or all", () => {
    expect(resolveWorkspaceTaskFilter("completed", false)).toBe("completed");
    expect(resolveWorkspaceTaskFilter("all", false)).toBe("all");
    expect(resolveWorkspaceTaskFilter("completed", true)).toBe("completed");
  });
});
