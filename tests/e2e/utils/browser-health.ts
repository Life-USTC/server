import { type ConsoleMessage, expect, type Page } from "@playwright/test";

export type BrowserIssueKind = "console" | "pageerror";

export type BrowserIssue = {
  kind: BrowserIssueKind;
  message: string;
};

export type BrowserHealthAllowlist = Partial<
  Record<BrowserIssueKind, readonly RegExp[]>
>;

const FRAMEWORK_ERROR_OVERLAYS = [
  "vite-error-overlay",
  "nextjs-portal",
  "#webpack-dev-server-client-overlay",
  "[data-nextjs-dialog-overlay]",
].join(", ");

export function browserIssueIsAllowed(
  issue: BrowserIssue,
  allowlist: BrowserHealthAllowlist = {},
) {
  return (allowlist[issue.kind] ?? []).some((pattern) => {
    pattern.lastIndex = 0;
    return pattern.test(issue.message);
  });
}

export function unexpectedBrowserIssues(
  issues: readonly BrowserIssue[],
  allowlist: BrowserHealthAllowlist = {},
) {
  return issues.filter((issue) => !browserIssueIsAllowed(issue, allowlist));
}

export function observeBrowserHealth(page: Page) {
  const issues: BrowserIssue[] = [];
  const onConsole = (message: ConsoleMessage) => {
    if (message.type() === "error") {
      issues.push({ kind: "console", message: message.text() });
    }
  };
  const onPageError = (error: Error) => {
    issues.push({ kind: "pageerror", message: error.message });
  };

  page.on("console", onConsole);
  page.on("pageerror", onPageError);

  return {
    issues,
    stop() {
      page.off("console", onConsole);
      page.off("pageerror", onPageError);
    },
  };
}

export async function expectNoFrameworkErrorOverlay(page: Page) {
  await expect(
    page.locator(FRAMEWORK_ERROR_OVERLAYS).filter({ visible: true }),
    "Expected no visible framework error overlay",
  ).toHaveCount(0);
}
