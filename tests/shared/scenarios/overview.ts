import { expect } from "vitest";

/**
 * Cross-adapter overview invariants for a user subscribed to the seed section
 * at `DEV_SEED_ANCHOR` time. Adapters expose different field names; normalize
 * before asserting.
 *
 * Normalizers must not default missing fields to `0` — a snapshot field is
 * `undefined` exactly when the adapter does not expose it, which is what makes
 * the assertions below able to fail.
 */

export type OverviewCountSnapshot = {
  todaySchedulesCount: number | undefined;
  upcomingExamsCount: number | undefined;
  pendingTodosCount?: number;
  pendingHomeworksCount?: number;
};

export type OverviewSampleSnapshot = {
  dueTodosCount?: number;
  dueHomeworksCount?: number;
  schedulesCount?: number;
  examsCount?: number;
};

/** MCP `workspace_overview_get` payload (full/default). */
export function normalizeMcpOverviewPayload(payload: {
  overview?: {
    pendingTodosCount?: number;
    pendingHomeworksCount?: number;
    todaySchedulesCount?: number;
    upcomingExamsCount?: number;
  };
  samples?: {
    dueTodos?: unknown[];
    dueHomeworks?: unknown[];
    upcomingExams?: unknown[];
  };
}): OverviewCountSnapshot & OverviewSampleSnapshot {
  return {
    pendingTodosCount: payload.overview?.pendingTodosCount,
    pendingHomeworksCount: payload.overview?.pendingHomeworksCount,
    todaySchedulesCount: payload.overview?.todaySchedulesCount,
    upcomingExamsCount: payload.overview?.upcomingExamsCount,
    dueTodosCount: payload.samples?.dueTodos?.length,
    dueHomeworksCount: payload.samples?.dueHomeworks?.length,
    // MCP exposes no schedule samples, so `schedulesCount` stays undefined.
    examsCount: payload.samples?.upcomingExams?.length,
  };
}

/** REST `GET /api/workspace/overview` JSON body. */
export function normalizeRestOverviewPayload(body: {
  counts?: {
    todos?: { incomplete?: number };
    pendingHomeworks?: number;
    todaySchedules?: number;
    upcomingExams?: number;
  };
  schedules?: { items?: unknown[] };
  dueTodos?: { items?: unknown[] };
  homeworks?: { items?: unknown[] };
  exams?: { items?: unknown[] };
}): OverviewCountSnapshot & OverviewSampleSnapshot {
  return {
    pendingTodosCount: body.counts?.todos?.incomplete,
    pendingHomeworksCount: body.counts?.pendingHomeworks,
    todaySchedulesCount: body.counts?.todaySchedules,
    upcomingExamsCount: body.counts?.upcomingExams,
    dueTodosCount: body.dueTodos?.items?.length,
    dueHomeworksCount: body.homeworks?.items?.length,
    schedulesCount: body.schedules?.items?.length,
    examsCount: body.exams?.items?.length,
  };
}

/** GraphQL `workspace.overview` selection. */
export function normalizeGraphqlOverviewPayload(overview: {
  incompleteTodos?: number;
  pendingHomeworks?: number;
  todaySchedules?: number;
  upcomingExams?: number;
  today?: string;
}): OverviewCountSnapshot & { today?: string } {
  return {
    pendingTodosCount: overview.incompleteTodos,
    pendingHomeworksCount: overview.pendingHomeworks,
    todaySchedulesCount: overview.todaySchedules,
    upcomingExamsCount: overview.upcomingExams,
    today: overview.today,
  };
}

function expectCount(value: number | undefined, label: string): number {
  if (typeof value !== "number") {
    expect.fail(`${label} should be a number, got ${String(value)}`);
  }
  return value;
}

/**
 * Seed-day schedule presence: a user subscribed to the seed section must see
 * at least one schedule for the canonical seed day.
 */
export function assertSeedDayOverviewScheduleCounts(
  counts: OverviewCountSnapshot,
) {
  expect(
    expectCount(counts.todaySchedulesCount, "todaySchedulesCount"),
  ).toBeGreaterThan(0);
  expect(
    expectCount(counts.upcomingExamsCount, "upcomingExamsCount"),
  ).toBeGreaterThanOrEqual(0);
}

/**
 * When samples are requested with an explicit limit, list lengths must not
 * exceed that limit. Adapters that expose no such list leave the key undefined.
 */
export function assertOverviewSampleLimit(
  samples: OverviewSampleSnapshot,
  limit: number,
) {
  for (const key of [
    "dueTodosCount",
    "dueHomeworksCount",
    "schedulesCount",
    "examsCount",
  ] as const) {
    const value = samples[key];
    if (typeof value === "number") {
      expect(value, key).toBeLessThanOrEqual(limit);
    }
  }
}

export function assertOverviewCountsAreNumbers(counts: OverviewCountSnapshot) {
  expectCount(counts.todaySchedulesCount, "todaySchedulesCount");
  expectCount(counts.upcomingExamsCount, "upcomingExamsCount");
  expectCount(counts.pendingTodosCount, "pendingTodosCount");
  expectCount(counts.pendingHomeworksCount, "pendingHomeworksCount");
}
