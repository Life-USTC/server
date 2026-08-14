import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

export type UiQualityIssueKind =
  | "accessibility"
  | "broken-image"
  | "duplicate-id"
  | "empty-heading"
  | "invalid-link"
  | "structure";

export type UiQualityIssue = {
  kind: UiQualityIssueKind;
  element: string;
  detail: string;
};

export type UiQualityException = {
  match: RegExp;
  reason: string;
};

export type UiQualityAllowlist = Partial<
  Record<UiQualityIssueKind, readonly UiQualityException[]>
>;

export type UiQualityReport = {
  documentLang: string;
  title: string;
  issues: UiQualityIssue[];
};

export function uiQualityIssueIsAllowed(
  issue: UiQualityIssue,
  allowlist: UiQualityAllowlist = {},
) {
  const description = `${issue.element}: ${issue.detail}`;
  return (allowlist[issue.kind] ?? []).some((exception) => {
    exception.match.lastIndex = 0;
    return (
      exception.reason.trim().length > 0 && exception.match.test(description)
    );
  });
}

export function unexpectedUiQualityIssues(
  issues: readonly UiQualityIssue[],
  allowlist: UiQualityAllowlist = {},
) {
  return issues.filter((issue) => !uiQualityIssueIsAllowed(issue, allowlist));
}

export async function auditRenderedUi(page: Page): Promise<UiQualityReport> {
  return page.evaluate(() => {
    type BrowserIssue = {
      kind:
        | "broken-image"
        | "duplicate-id"
        | "empty-heading"
        | "invalid-link"
        | "structure";
      element: string;
      detail: string;
    };

    const issues: BrowserIssue[] = [];

    const describeElement = (element: Element) => {
      const id = element.getAttribute("id");
      if (id) return `${element.tagName.toLowerCase()}#${id}`;
      const testId = element.getAttribute("data-testid");
      if (testId) {
        return `${element.tagName.toLowerCase()}[data-testid="${testId}"]`;
      }
      const name = element.getAttribute("name");
      if (name) return `${element.tagName.toLowerCase()}[name="${name}"]`;
      return element.tagName.toLowerCase();
    };

    const isVisible = (element: Element) => {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        style.opacity !== "0" &&
        rect.width > 0 &&
        rect.height > 0
      );
    };

    const elementName = (element: Element) => {
      const ariaLabel = element.getAttribute("aria-label")?.trim();
      if (ariaLabel) return ariaLabel;

      const text = element.textContent?.trim();
      if (text) return text;

      const title = element.getAttribute("title")?.trim();
      return title ?? "";
    };

    const visibleMainLandmarks = Array.from(
      document.querySelectorAll("main"),
    ).filter(isVisible);
    if (visibleMainLandmarks.length !== 1) {
      issues.push({
        kind: "structure",
        element: "main",
        detail: `expected exactly one visible main landmark, found ${visibleMainLandmarks.length}`,
      });
    }

    const mainContent = document.querySelectorAll("#main-content");
    if (mainContent.length !== 1 || !isVisible(mainContent[0])) {
      issues.push({
        kind: "structure",
        element: "#main-content",
        detail: `expected exactly one visible main content target, found ${mainContent.length}`,
      });
    }

    const visibleLevelOneHeadings = Array.from(
      document.querySelectorAll(
        'h1:not([aria-level]), [role="heading"][aria-level="1"], h1[aria-level="1"]',
      ),
    ).filter(isVisible);
    if (visibleLevelOneHeadings.length < 1) {
      issues.push({
        kind: "structure",
        element: "h1",
        detail: "expected at least one visible level-one heading",
      });
    }

    const ids = new Map<string, Element[]>();
    for (const element of document.querySelectorAll("[id]")) {
      const id = element.id.trim();
      if (!id) continue;
      const matches = ids.get(id) ?? [];
      matches.push(element);
      ids.set(id, matches);
    }
    for (const [id, matches] of ids) {
      if (matches.length <= 1) continue;
      issues.push({
        kind: "duplicate-id",
        element: `#${id}`,
        detail: `${matches.length} elements use the same id`,
      });
    }

    for (const image of document.querySelectorAll("img")) {
      if (!isVisible(image)) continue;
      if (!image.complete) {
        issues.push({
          kind: "broken-image",
          element: describeElement(image),
          detail: `visible image did not finish loading: ${image.currentSrc || image.src}`,
        });
        continue;
      }
      if (image.naturalWidth === 0) {
        issues.push({
          kind: "broken-image",
          element: describeElement(image),
          detail: `visible image has no decoded pixels: ${image.currentSrc || image.src}`,
        });
      }
    }

    for (const link of document.querySelectorAll("a")) {
      if (!isVisible(link)) continue;
      const href = link.getAttribute("href")?.trim() ?? "";
      if (
        (!href && link.getAttribute("role") !== "button") ||
        /^javascript:/i.test(href)
      ) {
        issues.push({
          kind: "invalid-link",
          element: describeElement(link),
          detail: href ? `unsafe href ${href}` : "visible link has no href",
        });
      }
    }

    for (const heading of document.querySelectorAll("h1, h2, h3, h4, h5, h6")) {
      if (!isVisible(heading) || elementName(heading)) continue;
      issues.push({
        kind: "empty-heading",
        element: describeElement(heading),
        detail: "visible heading has no accessible text",
      });
    }

    return {
      documentLang: document.documentElement.lang,
      title: document.title,
      issues,
    };
  });
}

export async function auditAccessibility(
  page: Page,
): Promise<UiQualityIssue[]> {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    // Contrast, link-color, and target-size fixes intentionally change the
    // visual system. Keep this PR's no-visual-change contract structural and
    // track those visual accessibility checks separately.
    .disableRules(["color-contrast", "link-in-text-block", "target-size"])
    .analyze();

  return results.violations
    .filter(
      (violation) =>
        violation.impact === "critical" || violation.impact === "serious",
    )
    .flatMap((violation) =>
      violation.nodes.map((node) => ({
        kind: "accessibility" as const,
        element: node.target.join(" "),
        detail: `${violation.id} (${violation.impact}): ${violation.help}; ${node.html.replace(/\s+/g, " ").slice(0, 240)}`,
      })),
    );
}

export async function expectRenderedUiQuality(
  page: Page,
  allowlist: UiQualityAllowlist = {},
) {
  const report = await auditRenderedUi(page);
  expect(
    report.title.trim(),
    "Expected the page to have a non-empty title",
  ).not.toBe("");
  expect(
    report.documentLang,
    "Expected the document language to be zh-cn or en-us",
  ).toMatch(/^(?:zh-cn|en-us)$/i);

  await expect
    .poll(
      async () => {
        const current = await auditRenderedUi(page);
        return unexpectedUiQualityIssues(current.issues, allowlist);
      },
      {
        message:
          "Expected visible UI elements to have valid ids, assets, links, headings, and accessible names",
        timeout: 5_000,
      },
    )
    .toEqual([]);

  expect(
    unexpectedUiQualityIssues(await auditAccessibility(page), allowlist),
    "Expected no serious or critical WCAG A/AA violations",
  ).toEqual([]);
}
