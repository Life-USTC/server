import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

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

export type AccessibilityAudit = {
  violations: UiQualityIssue[];
  /**
   * axe reports a node as `incomplete` when a rule cannot decide on its own.
   * `color-contrast` does that for text over a background image or gradient,
   * text another element covers, images of text, and partially transparent
   * foregrounds — exactly the places a contrast regression can hide. These do
   * not fail the gate; `expectRenderedUiQuality` records them for review.
   *
   * Counted per rule rather than listed per node: a page can produce hundreds
   * of undecidable nodes, and a wall of them is read by nobody.
   */
  incomplete: IncompleteRuleSummary[];
};

export type IncompleteRuleSummary = {
  rule: string;
  help: string;
  nodes: number;
  elements: string[];
};

/** Enough targets to locate the problem, few enough to read in a report. */
const MAX_SUMMARY_ELEMENTS = 5;

export async function auditAccessibility(
  page: Page,
): Promise<AccessibilityAudit> {
  // Bun installs Playwright's exact core dependency beside its peer copy used
  // by axe. They are the same runtime version but TypeScript treats the two
  // Page declarations as distinct module instances.
  type AxePage = ConstructorParameters<typeof AxeBuilder>[0]["page"];
  const results = await new AxeBuilder({ page: page as unknown as AxePage })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    // Every WCAG rule in the tag set above is enforced. `color-contrast` was
    // the last exemption; the role text tokens cleared it, and this change
    // clears `target-size` (SC 2.5.8). Adding a rule back to a disable list
    // means a visual regression went unfixed, so prefer fixing the nodes.
    .analyze();

  const violations: UiQualityIssue[] = results.violations
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

  const incomplete: IncompleteRuleSummary[] = results.incomplete.map(
    (result) => ({
      rule: result.id,
      help: result.help,
      nodes: result.nodes.length,
      elements: result.nodes
        .slice(0, MAX_SUMMARY_ELEMENTS)
        .map((node) => node.target.join(" ")),
    }),
  );

  return { violations, incomplete };
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

  // Entrance animations fade content in from `opacity: 0`, and a colour
  // measured mid-fade is not the colour that ships: auditing /usage/cli 200ms
  // after load reports 13 contrast failures that are all gone once the
  // animation settles. Poll like the structural audit above so a transient
  // frame cannot fail the gate while a real violation still does.
  let lastAudit: AccessibilityAudit | undefined;
  await expect
    .poll(
      async () => {
        lastAudit = await auditAccessibility(page);
        return unexpectedUiQualityIssues(lastAudit.violations, allowlist);
      },
      {
        message: "Expected no serious or critical WCAG A/AA violations",
        timeout: 10_000,
      },
    )
    .toEqual([]);

  // Record what axe could not decide. Failing on these would be too noisy to
  // live with, but leaving them unread is how a contrast regression behind a
  // gradient stays invisible, so attach the counts to the run for review.
  const incomplete = lastAudit?.incomplete ?? [];
  if (incomplete.length > 0) {
    await test.info().attach(`axe-incomplete-${new URL(page.url()).pathname}`, {
      body: JSON.stringify(incomplete, null, 2),
      contentType: "application/json",
    });
  }
}
