/**
 * Shared subscription arrange/assert helpers for REST and MCP adapters.
 */

import { expect } from "vitest";

export type SubscriptionBrief = {
  sectionCount?: number;
  currentSemesterSectionCount?: number;
  sections?: unknown;
  currentSemesterSections?: unknown;
};

export function assertSubscriptionBrief(
  subscription: SubscriptionBrief | null | undefined,
  options: { expectSections?: boolean } = {},
) {
  expect(subscription).toBeTruthy();
  if (subscription?.sectionCount !== undefined) {
    expect(typeof subscription.sectionCount).toBe("number");
  }
  if (options.expectSections) {
    const sections = subscription?.sections;
    expect(Array.isArray(sections)).toBe(true);
    if (Array.isArray(sections)) {
      expect(sections.length).toBeGreaterThan(0);
    }
  } else if (subscription && "sections" in subscription) {
    // default/brief mode omits the full section list
    expect(subscription.sections).toBeUndefined();
  }
}

export function assertSubscriptionAction(
  result: {
    success?: boolean;
    action?: string;
    sectionJwId?: number;
  },
  expectedJwId: number,
  allowedActions: readonly string[],
) {
  expect(result.success).toBe(true);
  expect(allowedActions).toContain(result.action);
  expect(result.sectionJwId).toBe(expectedJwId);
}
