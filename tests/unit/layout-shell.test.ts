import { describe, expect, it } from "vitest";
import {
  isDetailWorkspacePath,
  shouldShowAppFooter,
} from "@/lib/components/shell/layout-shell";

describe("application shell footer policy", () => {
  it.each([
    ["/courses/123", true],
    ["/sections/123/homework", true],
    ["/teachers/123", true],
    ["/courses", false],
  ])("identifies detail workspace path %s", (pathname, expected) => {
    expect(isDetailWorkspacePath(pathname)).toBe(expected);
  });

  it.each([
    ["/", false, true],
    ["/", true, false],
    ["/dashboard", true, false],
    ["/dashboard/exams", true, false],
    ["/settings/profile", true, false],
    ["/admin/oauth", true, false],
    ["/welcome", true, false],
    ["/courses", false, true],
    ["/courses", true, true],
    ["/guides/markdown-support", true, true],
    ["/courses/123", false, false],
  ])("pathname %s with signedIn=%s shows footer=%s", (pathname, signedIn, expected) => {
    expect(shouldShowAppFooter(pathname, signedIn)).toBe(expected);
  });
});
