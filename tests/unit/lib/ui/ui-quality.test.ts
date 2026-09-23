import { describe, expect, it } from "vitest";
import {
  type UiQualityIssue,
  uiQualityIssueIsAllowed,
  unexpectedUiQualityIssues,
} from "../../../e2e/utils/ui-quality";

const issues: UiQualityIssue[] = [
  {
    kind: "broken-image",
    element: "img#hero",
    detail: "visible image has no decoded pixels: /hero.png",
  },
  {
    kind: "invalid-link",
    element: "a[data-testid=menu]",
    detail: "visible link has no href",
  },
];

describe("UI quality allowlists", () => {
  it("matches only the issue kind and description explicitly allowed", () => {
    expect(
      uiQualityIssueIsAllowed(issues[0], {
        "broken-image": [
          {
            match: /img#hero: .*hero\.png/,
            reason: "The fixture intentionally uses a missing image.",
          },
        ],
      }),
    ).toBe(true);
    expect(
      uiQualityIssueIsAllowed(issues[1], {
        "broken-image": [
          { match: /menu/, reason: "This does not match the issue kind." },
        ],
      }),
    ).toBe(false);
  });

  it("keeps unmatched issues visible to the page contract", () => {
    expect(
      unexpectedUiQualityIssues(issues, {
        "broken-image": [
          {
            match: /hero\.png/,
            reason: "The fixture intentionally uses a missing image.",
          },
        ],
      }),
    ).toEqual([issues[1]]);
  });

  it("resets stateful regular expressions before each match", () => {
    const pattern = /hero/g;
    expect(
      uiQualityIssueIsAllowed(issues[0], {
        "broken-image": [{ match: pattern, reason: "Stateful regex fixture." }],
      }),
    ).toBe(true);
    expect(
      uiQualityIssueIsAllowed(issues[0], {
        "broken-image": [{ match: pattern, reason: "Stateful regex fixture." }],
      }),
    ).toBe(true);
  });

  it("rejects an exception without a reason", () => {
    expect(
      uiQualityIssueIsAllowed(issues[0], {
        "broken-image": [{ match: /hero/, reason: "" }],
      }),
    ).toBe(false);
  });
});
