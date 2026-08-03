import { expect } from "vitest";

/**
 * Cross-adapter section homework create invariants. REST and MCP both call
 * `createHomeworkForSection` in `features/homeworks/server`.
 */

export function assertHomeworkCreateSuccess<
  T extends {
    id?: string | null;
    success?: boolean;
    homework?: { id?: string } | null;
  },
>(result: T): asserts result is T & { id: string } {
  if (result.success !== undefined) {
    expect(result.success).toBe(true);
  }
  expect(typeof result.id).toBe("string");
  expect(result.id).toBeTruthy();
  if (result.homework) {
    expect(result.homework.id).toBe(result.id);
  }
}

export function assertHomeworkCreateEcho(
  result: {
    id?: string;
    homework?: {
      id?: string;
      title?: string;
      isMajor?: boolean;
      requiresTeam?: boolean;
      description?: { content?: string | null } | null;
    } | null;
  },
  expected: {
    title: string;
    isMajor?: boolean;
    requiresTeam?: boolean;
    description?: string | null;
  },
) {
  assertHomeworkCreateSuccess(result);
  expect(result.homework?.title).toBe(expected.title);
  if (expected.isMajor !== undefined) {
    expect(result.homework?.isMajor).toBe(expected.isMajor);
  }
  if (expected.requiresTeam !== undefined) {
    expect(result.homework?.requiresTeam).toBe(expected.requiresTeam);
  }
  if (expected.description !== undefined) {
    expect(result.homework?.description?.content ?? null).toBe(
      expected.description,
    );
  }
}

export function assertHomeworkListedByTitle(
  homeworks: Array<{ id?: string; title?: string }>,
  expected: { id: string; title: string },
) {
  expect(
    homeworks.some(
      (item) => item.id === expected.id && item.title === expected.title,
    ),
  ).toBe(true);
}
