import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readPrometheusMetrics } from "@/features/admin/server/prometheus-metrics-data";
import { Prisma } from "@/generated/prisma/client";
import { prisma as runtimePrisma } from "@/lib/db/prisma";
import { createFixturePrisma, disconnectTestPrisma } from "../shared/prisma";

const fixturePrisma = createFixturePrisma();
const marker = `prometheus-metrics-${crypto.randomUUID()}`;
const day = 24 * 60 * 60 * 1000;
const shanghaiOffset = 8 * 60 * 60 * 1000;

const userIds = [`${marker}-user-one`, `${marker}-user-two`] as const;
const eventIds = [
  crypto.randomUUID(),
  crypto.randomUUID(),
  crypto.randomUUID(),
  crypto.randomUUID(),
];
const runtimeIssueIds = [crypto.randomUUID(), crypto.randomUUID()];
const commentId = `${marker}-comment`;
const homeworkId = `${marker}-homework`;
const suspensionIds = [
  `${marker}-active-suspension`,
  `${marker}-lifted-suspension`,
] as const;
const clientIds = [`${marker}-client-current`, `${marker}-client-old`] as const;
const auditIds = [
  `${marker}-audit-recent`,
  `${marker}-audit-boundary`,
  `${marker}-audit-oauth-excluded`,
  `${marker}-audit-oauth-included`,
  `${marker}-audit-old`,
] as const;
const oauthUsageIds = [
  `${marker}-oauth-current`,
  `${marker}-oauth-boundary`,
  `${marker}-oauth-old`,
] as const;

const featureName = "catalog.search";
const featureOperation = "search";
const runtimeEventName = `${marker}.issue`;

type CalendarWindow = "today" | "7d" | "30d";
type MetricsWindow = "5m" | CalendarWindow;
type AuditAction =
  | "admin_user_suspend"
  | "admin_user_unsuspend"
  | "oauth_authorization_grant"
  | "oauth_authorization_update"
  | "admin_bus_import";
type AuditChannel = "web" | "mcp" | "auth" | "system";
type AuditOutcome = "success" | "failure";

type FeatureFixture = {
  id: string;
  occurredAt: Date;
  feature: string;
  operation: string;
  protocol: string;
  surface: string;
  authMode: string;
  outcome: string;
  errorClass: string;
  durationMs: number;
  userId: string;
};

type RuntimeFixture = {
  id: string;
  occurredAt: Date;
  level: string;
  event: string;
  status: number;
};

type AuditFixture = {
  id: string;
  action: AuditAction;
  channel: AuditChannel;
  outcome: AuditOutcome;
  createdAt: Date;
  oauthClientId?: string;
  included: boolean;
};

type OAuthUsageFixture = {
  id: string;
  userId: string;
  clientId: string;
  day: Date;
  feature: "account.profile";
  channel: "mcp";
  readCount: number;
  writeCount: number;
  errorCount: number;
};

let baseline: Awaited<ReturnType<typeof readPrometheusMetrics>>;
let featureFixtures: FeatureFixture[] = [];
let runtimeFixtures: RuntimeFixture[] = [];
let auditFixtures: AuditFixture[] = [];
let oauthUsageFixtures: OAuthUsageFixture[] = [];

const calendarWindows: CalendarWindow[] = ["today", "7d", "30d"];
const metricsWindows: MetricsWindow[] = ["5m", ...calendarWindows];
const calendarWindowAge = {
  today: 0,
  "7d": 6,
  "30d": 29,
} as const;

function shanghaiDateKey(value: Date): string {
  return new Date(value.getTime() + shanghaiOffset).toISOString().slice(0, 10);
}

function addDateKeyDays(dateKey: string, days: number): string {
  const value = new Date(`${dateKey}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function shanghaiDayStart(value: Date): number {
  const shifted = new Date(value.getTime() + shanghaiOffset);
  return (
    Date.UTC(
      shifted.getUTCFullYear(),
      shifted.getUTCMonth(),
      shifted.getUTCDate(),
    ) - shanghaiOffset
  );
}

function isInMetricsWindow(
  occurredAt: Date,
  generatedAt: Date,
  window: MetricsWindow,
): boolean {
  const end = generatedAt.getTime();
  const start =
    window === "5m"
      ? end - 5 * 60 * 1000
      : shanghaiDayStart(generatedAt) - calendarWindowAge[window] * day;
  const timestamp = occurredAt.getTime();
  return timestamp >= start && timestamp <= end;
}

function isInOAuthWindow(
  usageDay: Date,
  generatedAt: Date,
  window: CalendarWindow,
): boolean {
  const currentDay = shanghaiDateKey(generatedAt);
  const usageDayKey = usageDay.toISOString().slice(0, 10);
  const firstDay = addDateKeyDays(currentDay, -calendarWindowAge[window]);
  return usageDayKey >= firstDay && usageDayKey <= currentDay;
}

function getRow<T>(row: T | undefined, description: string): T {
  if (!row) {
    throw new Error(`Expected metrics row: ${description}`);
  }
  return row;
}

function countAuditRows(
  snapshot: Awaited<ReturnType<typeof readPrometheusMetrics>>,
  fixture: AuditFixture,
  window: CalendarWindow,
): number {
  return (
    snapshot.audit.find(
      (row) =>
        row.window === window &&
        row.action === fixture.action &&
        row.channel === fixture.channel &&
        row.outcome === fixture.outcome,
    )?.events ?? 0
  );
}

function getOAuthRow(
  snapshot: Awaited<ReturnType<typeof readPrometheusMetrics>>,
  fixture: OAuthUsageFixture,
  window: CalendarWindow,
) {
  return snapshot.oauth.find(
    (row) =>
      row.window === window &&
      row.channel === fixture.channel &&
      row.feature === fixture.feature,
  );
}

function getOAuthSummaryRow(
  snapshot: Awaited<ReturnType<typeof readPrometheusMetrics>>,
  window: CalendarWindow,
) {
  return getRow(
    snapshot.oauthSummary.find((row) => row.window === window),
    `oauth summary ${window}`,
  );
}

describe("Prometheus metrics data layer", () => {
  beforeAll(async () => {
    await fixturePrisma.$executeRaw`DELETE FROM public."PrometheusMetricsCache"`;

    const referenceRow = (
      await fixturePrisma.$queryRaw<{ now: Date }[]>(
        Prisma.sql`SELECT statement_timestamp() AS now`,
      )
    )[0];
    if (!referenceRow) {
      throw new Error("Unable to establish the fixture database timestamp");
    }
    const referenceNow = referenceRow.now;

    baseline = await readPrometheusMetrics();

    const recentA = new Date(referenceNow.getTime() - 30_000);
    const recentB = new Date(referenceNow.getTime() - 60_000);
    const eightDaysAgo = new Date(referenceNow.getTime() - 8 * day);
    const fortyDaysAgo = new Date(referenceNow.getTime() - 40 * day);

    await fixturePrisma.user.createMany({
      data: [
        {
          id: userIds[0],
          email: `${marker}-one@example.test`,
          name: `${marker}-one`,
          createdAt: recentA,
        },
        {
          id: userIds[1],
          email: `${marker}-two@example.test`,
          name: `${marker}-two`,
          createdAt: fortyDaysAgo,
        },
      ],
    });

    featureFixtures = [
      {
        id: eventIds[0],
        occurredAt: recentA,
        feature: featureName,
        operation: featureOperation,
        protocol: "mcp",
        surface: "mcp",
        authMode: "oauth",
        outcome: "success",
        errorClass: "none",
        durationMs: 1_000,
        userId: userIds[0],
      },
      {
        id: eventIds[1],
        occurredAt: recentB,
        feature: featureName,
        operation: featureOperation,
        protocol: "mcp",
        surface: "mcp",
        authMode: "oauth",
        outcome: "success",
        errorClass: "none",
        durationMs: 2_000,
        userId: userIds[1],
      },
      {
        id: eventIds[2],
        occurredAt: eightDaysAgo,
        feature: "workspace.subscription",
        operation: "list",
        protocol: "graphql",
        surface: "unknown",
        authMode: "session",
        outcome: "rejected",
        errorClass: "unauthorized",
        durationMs: 500,
        userId: userIds[0],
      },
      {
        id: eventIds[3],
        occurredAt: fortyDaysAgo,
        feature: "catalog.course",
        operation: "get",
        protocol: "rest",
        surface: "web",
        authMode: "anonymous",
        outcome: "success",
        errorClass: "none",
        durationMs: 100,
        userId: userIds[0],
      },
    ];
    await fixturePrisma.featureOperationEvent.createMany({
      data: featureFixtures,
    });

    runtimeFixtures = [
      {
        id: runtimeIssueIds[0],
        occurredAt: recentA,
        level: "error",
        event: runtimeEventName,
        status: 503,
      },
      {
        id: runtimeIssueIds[1],
        occurredAt: fortyDaysAgo,
        level: "error",
        event: runtimeEventName,
        status: 503,
      },
    ];
    await fixturePrisma.runtimeIssueEvent.createMany({ data: runtimeFixtures });

    const section = await fixturePrisma.section.findFirst({
      select: { id: true },
    });
    if (!section) {
      throw new Error(
        "The seeded database has no section for the homework fixture",
      );
    }

    await fixturePrisma.comment.create({
      data: {
        id: commentId,
        body: `${marker} comment`,
        userId: userIds[0],
        createdAt: recentA,
        sectionId: section.id,
      },
    });
    await fixturePrisma.homework.create({
      data: {
        id: homeworkId,
        title: `${marker} homework`,
        sectionId: section.id,
        createdById: userIds[0],
        createdAt: recentA,
        updatedAt: recentA,
      },
    });

    await fixturePrisma.userSuspension.createMany({
      data: [
        {
          id: suspensionIds[0],
          userId: userIds[0],
          createdAt: recentA,
          expiresAt: new Date(referenceNow.getTime() + day),
          reason: marker,
        },
        {
          id: suspensionIds[1],
          userId: userIds[1],
          createdAt: eightDaysAgo,
          liftedAt: recentB,
          reason: marker,
        },
      ],
    });

    await fixturePrisma.oAuthClient.createMany({
      data: [
        {
          clientId: clientIds[0],
          name: `${marker} current client`,
          redirectUris: [`https://${marker}.example.test/callback`],
          createdAt: recentA,
          updatedAt: recentA,
        },
        {
          clientId: clientIds[1],
          name: `${marker} old client`,
          redirectUris: [`https://${marker}.example.test/old-callback`],
          createdAt: fortyDaysAgo,
          updatedAt: fortyDaysAgo,
        },
      ],
    });

    auditFixtures = [
      {
        id: auditIds[0],
        action: "admin_user_suspend",
        channel: "web",
        outcome: "success",
        createdAt: recentA,
        included: true,
      },
      {
        id: auditIds[1],
        action: "admin_user_unsuspend",
        channel: "system",
        outcome: "failure",
        createdAt: eightDaysAgo,
        included: true,
      },
      {
        id: auditIds[2],
        action: "oauth_authorization_grant",
        channel: "mcp",
        outcome: "success",
        createdAt: recentA,
        oauthClientId: clientIds[0],
        included: false,
      },
      {
        id: auditIds[3],
        action: "oauth_authorization_update",
        channel: "auth",
        outcome: "success",
        createdAt: recentB,
        oauthClientId: clientIds[0],
        included: true,
      },
      {
        id: auditIds[4],
        action: "admin_bus_import",
        channel: "system",
        outcome: "failure",
        createdAt: fortyDaysAgo,
        included: true,
      },
    ];
    await fixturePrisma.auditLog.createMany({
      data: auditFixtures.map(
        ({ id, action, channel, outcome, createdAt, oauthClientId }) => ({
          id,
          action,
          channel,
          outcome,
          createdAt,
          oauthClientId,
        }),
      ),
    });

    const today = new Date(`${shanghaiDateKey(referenceNow)}T00:00:00.000Z`);
    const eightDaysAgoDay = new Date(today.getTime() - 8 * day);
    const fortyDaysAgoDay = new Date(today.getTime() - 40 * day);
    oauthUsageFixtures = [
      {
        id: oauthUsageIds[0],
        userId: userIds[0],
        clientId: clientIds[0],
        day: today,
        feature: "account.profile",
        channel: "mcp",
        readCount: 5,
        writeCount: 2,
        errorCount: 1,
      },
      {
        id: oauthUsageIds[1],
        userId: userIds[0],
        clientId: clientIds[0],
        day: eightDaysAgoDay,
        feature: "account.profile",
        channel: "mcp",
        readCount: 7,
        writeCount: 3,
        errorCount: 4,
      },
      {
        id: oauthUsageIds[2],
        userId: userIds[1],
        clientId: clientIds[1],
        day: fortyDaysAgoDay,
        feature: "account.profile",
        channel: "mcp",
        readCount: 99,
        writeCount: 99,
        errorCount: 99,
      },
    ];
    await fixturePrisma.oAuthGrantUsageDaily.createMany({
      data: oauthUsageFixtures.map((usage) => ({
        ...usage,
        grantKey: `${marker}-${usage.id}`,
        lastUsedAt: referenceNow,
      })),
    });

    await fixturePrisma.$executeRaw`
      DELETE FROM public."PrometheusMetricsCache"
    `;
  });

  afterAll(async () => {
    try {
      await fixturePrisma.oAuthGrantUsageDaily.deleteMany({
        where: { id: { in: [...oauthUsageIds] } },
      });
      await fixturePrisma.auditLog.deleteMany({
        where: { id: { in: [...auditIds] } },
      });
      await fixturePrisma.userSuspension.deleteMany({
        where: { id: { in: [...suspensionIds] } },
      });
      await fixturePrisma.comment.deleteMany({ where: { id: commentId } });
      await fixturePrisma.homework.deleteMany({ where: { id: homeworkId } });
      await fixturePrisma.oAuthClient.deleteMany({
        where: { clientId: { in: [...clientIds] } },
      });
      await fixturePrisma.runtimeIssueEvent.deleteMany({
        where: { id: { in: runtimeIssueIds } },
      });
      await fixturePrisma.featureOperationEvent.deleteMany({
        where: { id: { in: eventIds } },
      });
      await fixturePrisma.user.deleteMany({
        where: { id: { in: [...userIds] } },
      });
      await fixturePrisma.$executeRaw`
        DELETE FROM public."PrometheusMetricsCache"
      `;
    } finally {
      await Promise.all([
        runtimePrisma.$disconnect(),
        disconnectTestPrisma(fixturePrisma),
      ]);
    }
  });

  it("refreshes a sanitized snapshot and serves the cached value", async () => {
    const first = await readPrometheusMetrics();
    const second = await readPrometheusMetrics();

    expect(second.generatedAt).toBe(first.generatedAt);
    expect(first.firstFeatureRecordedAt).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
    );

    const recent = first.features.filter(
      (row) =>
        row.feature === featureName &&
        row.operation === featureOperation &&
        row.protocol === "mcp" &&
        row.surface === "mcp" &&
        row.authMode === "oauth" &&
        row.outcome === "success" &&
        row.errorClass === "none",
    );
    expect(recent).toHaveLength(metricsWindows.length);
    for (const window of metricsWindows) {
      const row = getRow(
        recent.find((candidate) => candidate.window === window),
        `feature ${window}`,
      );
      const expected = featureFixtures.filter(
        (fixture) =>
          fixture.feature === featureName &&
          fixture.operation === featureOperation &&
          fixture.protocol === "mcp" &&
          fixture.surface === "mcp" &&
          fixture.authMode === "oauth" &&
          fixture.outcome === "success" &&
          fixture.errorClass === "none" &&
          isInMetricsWindow(
            fixture.occurredAt,
            new Date(first.generatedAt),
            window,
          ),
      );
      const baselineRow = baseline.features.find(
        (candidate) =>
          candidate.window === window &&
          candidate.feature === featureName &&
          candidate.operation === featureOperation &&
          candidate.protocol === "mcp" &&
          candidate.surface === "mcp" &&
          candidate.authMode === "oauth" &&
          candidate.outcome === "success" &&
          candidate.errorClass === "none",
      );
      expect(row.events).toBe((baselineRow?.events ?? 0) + expected.length);
      expect(row.users).toBe(
        (baselineRow?.users ?? 0) +
          new Set(expected.map((fixture) => fixture.userId)).size,
      );
      expect(row.durationSeconds).toBe(
        (baselineRow?.durationSeconds ?? 0) +
          expected.reduce((sum, fixture) => sum + fixture.durationMs, 0) / 1000,
      );
      expect(row.maxDurationSeconds).toBe(
        Math.max(
          baselineRow?.maxDurationSeconds ?? 0,
          ...expected.map((fixture) => fixture.durationMs / 1000),
        ),
      );
    }

    const oldEvent = getRow(featureFixtures[3], "old feature fixture");
    const thirtyDayRow = getRow(
      recent.find((row) => row.window === "30d"),
      "feature 30d",
    );
    const baselineThirtyDayRow = baseline.features.find(
      (candidate) =>
        candidate.window === "30d" &&
        candidate.feature === featureName &&
        candidate.operation === featureOperation &&
        candidate.protocol === "mcp" &&
        candidate.surface === "mcp" &&
        candidate.authMode === "oauth" &&
        candidate.outcome === "success" &&
        candidate.errorClass === "none",
    );
    expect(thirtyDayRow.events).toBe((baselineThirtyDayRow?.events ?? 0) + 2);
    expect(oldEvent.occurredAt.getTime()).toBeLessThan(
      new Date(first.generatedAt).getTime() - 30 * day,
    );

    const boundaryRows = first.features.filter(
      (row) =>
        row.feature === "workspace.subscription" &&
        row.operation === "list" &&
        row.protocol === "graphql" &&
        row.surface === "unknown" &&
        row.authMode === "session" &&
        row.outcome === "rejected" &&
        row.errorClass === "unauthorized",
    );
    expect(boundaryRows).toHaveLength(metricsWindows.length);
    for (const window of metricsWindows) {
      const row = getRow(
        boundaryRows.find((candidate) => candidate.window === window),
        `subscription feature ${window}`,
      );
      const baselineRow = baseline.features.find(
        (candidate) =>
          candidate.window === window &&
          candidate.feature === "workspace.subscription" &&
          candidate.operation === "list" &&
          candidate.protocol === "graphql" &&
          candidate.surface === "unknown" &&
          candidate.authMode === "session" &&
          candidate.outcome === "rejected" &&
          candidate.errorClass === "unauthorized",
      );
      const expected = featureFixtures.filter(
        (fixture) =>
          fixture.feature === "workspace.subscription" &&
          fixture.operation === "list" &&
          fixture.protocol === "graphql" &&
          fixture.surface === "unknown" &&
          fixture.authMode === "session" &&
          fixture.outcome === "rejected" &&
          fixture.errorClass === "unauthorized" &&
          isInMetricsWindow(
            fixture.occurredAt,
            new Date(first.generatedAt),
            window,
          ),
      );
      expect(row.events).toBe((baselineRow?.events ?? 0) + expected.length);
      expect(row.users).toBe(
        (baselineRow?.users ?? 0) +
          new Set(expected.map((fixture) => fixture.userId)).size,
      );
      expect(row.durationSeconds).toBe(
        (baselineRow?.durationSeconds ?? 0) +
          expected.reduce((sum, fixture) => sum + fixture.durationMs, 0) / 1000,
      );
      expect(row.maxDurationSeconds).toBe(
        Math.max(
          baselineRow?.maxDurationSeconds ?? 0,
          ...expected.map((fixture) => fixture.durationMs / 1000),
        ),
      );
    }

    const retainedCourseRows = (snapshot: typeof first) =>
      snapshot.features.filter(
        (row) =>
          row.feature === "catalog.course" &&
          row.operation === "get" &&
          row.protocol === "rest",
      );
    expect(retainedCourseRows(first)).toEqual(retainedCourseRows(baseline));

    for (const window of metricsWindows) {
      const row = first.runtime.find(
        (candidate) =>
          candidate.window === window &&
          candidate.level === "error" &&
          candidate.event === "other" &&
          candidate.status === "5xx",
      );
      const baselineRow = baseline.runtime.find(
        (candidate) =>
          candidate.window === window &&
          candidate.level === "error" &&
          candidate.event === "other" &&
          candidate.status === "5xx",
      );
      const expected = runtimeFixtures.filter((fixture) =>
        isInMetricsWindow(
          fixture.occurredAt,
          new Date(first.generatedAt),
          window,
        ),
      ).length;
      expect(row?.events ?? 0).toBe((baselineRow?.events ?? 0) + expected);
    }
  });

  it("includes complete aggregate families with their policy exclusions", async () => {
    const snapshot = await readPrometheusMetrics();
    const generatedAt = new Date(snapshot.generatedAt);

    expect(snapshot.summary).toEqual({
      users: baseline.summary.users + 2,
      comments: baseline.summary.comments + 1,
      homeworks: baseline.summary.homeworks + 1,
      oauthClients: baseline.summary.oauthClients + 2,
      activeSuspensions: baseline.summary.activeSuspensions + 1,
    });

    for (const window of calendarWindows) {
      const row = getRow(
        snapshot.users.find((candidate) => candidate.window === window),
        `users ${window}`,
      );
      const baselineRow = getRow(
        baseline.users.find((candidate) => candidate.window === window),
        `baseline users ${window}`,
      );
      const registeredDelta = [
        { createdAt: featureFixtures[0]?.occurredAt },
        { createdAt: featureFixtures[3]?.occurredAt },
      ].filter(
        (user) =>
          user.createdAt &&
          isInMetricsWindow(user.createdAt, generatedAt, window),
      ).length;
      const activeDelta = new Set(
        featureFixtures
          .filter((fixture) =>
            isInMetricsWindow(fixture.occurredAt, generatedAt, window),
          )
          .map((fixture) => fixture.userId),
      ).size;
      expect(row.registeredUsers).toBe(
        baselineRow.registeredUsers + registeredDelta,
      );
      expect(row.activeUsers).toBe(
        (baselineRow.activeUsers ?? 0) + activeDelta,
      );
    }

    for (const fixture of auditFixtures) {
      for (const window of calendarWindows) {
        const baselineCount = countAuditRows(baseline, fixture, window);
        const fixtureCount =
          fixture.included &&
          isInMetricsWindow(fixture.createdAt, generatedAt, window)
            ? 1
            : 0;
        expect(countAuditRows(snapshot, fixture, window)).toBe(
          baselineCount + fixtureCount,
        );
      }
    }

    const oauthFixture = getRow(oauthUsageFixtures[0], "OAuth usage fixture");
    for (const window of calendarWindows) {
      const baselineRow = getOAuthRow(baseline, oauthFixture, window);
      const currentRow = getOAuthRow(snapshot, oauthFixture, window);
      const usagesInWindow = oauthUsageFixtures.filter(
        (candidate) =>
          candidate.feature === oauthFixture.feature &&
          candidate.channel === oauthFixture.channel &&
          isInOAuthWindow(candidate.day, generatedAt, window),
      );
      const expected = usagesInWindow.reduce(
        (sum, usage) => ({
          readCount: sum.readCount + usage.readCount,
          writeCount: sum.writeCount + usage.writeCount,
          errorCount: sum.errorCount + usage.errorCount,
        }),
        { readCount: 0, writeCount: 0, errorCount: 0 },
      );
      expect(currentRow?.readCount ?? 0).toBe(
        (baselineRow?.readCount ?? 0) + expected.readCount,
      );
      expect(currentRow?.writeCount ?? 0).toBe(
        (baselineRow?.writeCount ?? 0) + expected.writeCount,
      );
      expect(currentRow?.errorCount ?? 0).toBe(
        (baselineRow?.errorCount ?? 0) + expected.errorCount,
      );
    }

    for (const window of calendarWindows) {
      const expectedClients = new Set(
        oauthUsageFixtures
          .filter((fixture) =>
            isInOAuthWindow(fixture.day, generatedAt, window),
          )
          .map((fixture) => fixture.clientId),
      ).size;
      const baselineRow = getOAuthSummaryRow(baseline, window);
      expect(getOAuthSummaryRow(snapshot, window).activeClients).toBe(
        baselineRow.activeClients + expectedClients,
      );
    }
  });

  it("does not grant the runtime role direct access to raw cache rows", async () => {
    await expect(
      runtimePrisma.$queryRaw(Prisma.sql`
        SELECT "id" FROM public."PrometheusMetricsCache"
      `),
    ).rejects.toThrow();
  });
});
