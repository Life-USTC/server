import { describe, expect, it } from "vitest";
import {
  isDetailWorkspacePath,
  resolveShellTheme,
  shouldShowAppFooter,
} from "@/lib/components/shell/layout-shell";

describe("application shell footer policy", () => {
  it.each([
    ["/catalog/courses/123", true],
    ["/catalog/sections/123/homework", true],
    ["/catalog/teachers/123", true],
    ["/catalog/courses", false],
  ])("identifies detail workspace path %s", (pathname, expected) => {
    expect(isDetailWorkspacePath(pathname)).toBe(expected);
  });

  it.each([
    ["/", false, true],
    ["/", true, false],
    ["/workspace", true, false],
    ["/workspace/exams", true, false],
    ["/account/settings/profile", true, false],
    ["/admin/oauth", true, false],
    ["/account/welcome", true, false],
    ["/catalog/courses", false, true],
    ["/catalog/courses", true, true],
    ["/guides/markdown-support", true, true],
    ["/catalog/courses/123", false, false],
  ])("pathname %s with signedIn=%s shows footer=%s", (pathname, signedIn, expected) => {
    expect(shouldShowAppFooter(pathname, signedIn)).toBe(expected);
  });
});

describe("application shell theme", () => {
  it.each([
    ["light", false, "light"],
    ["light", true, "light"],
    ["dark", false, "dark"],
    ["dark", true, "dark"],
    ["system", false, "light"],
    ["system", true, "dark"],
  ] as const)("resolves %s with prefersDark=%s to %s", (mode, prefersDark, expected) => {
    expect(resolveShellTheme(mode, prefersDark)).toBe(expected);
  });
});
