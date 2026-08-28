import { describe, expect, it } from "vitest";
import {
  type BrowserIssue,
  browserIssueIsAllowed,
  unexpectedBrowserIssues,
} from "../e2e/utils/browser-health";

describe("browser health allowlisting", () => {
  const issues: BrowserIssue[] = [
    { kind: "console", message: "expected provider failure: offline" },
    { kind: "console", message: "unexpected hydration failure" },
    { kind: "pageerror", message: "ResizeObserver exploded" },
  ];

  it("requires an explicit kind-specific pattern", () => {
    expect(
      browserIssueIsAllowed(issues[0], {
        console: [/provider failure: offline$/],
      }),
    ).toBe(true);
    expect(
      browserIssueIsAllowed(issues[2], {
        console: [/ResizeObserver/],
      }),
    ).toBe(false);
  });

  it("returns only unexpected issues and supports reusable global regexes", () => {
    const allowlist = {
      console: [/expected provider failure/g],
    };

    expect(unexpectedBrowserIssues(issues, allowlist)).toEqual(issues.slice(1));
    expect(unexpectedBrowserIssues(issues, allowlist)).toEqual(issues.slice(1));
  });
});
