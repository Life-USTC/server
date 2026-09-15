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
let userFixtures: Array<{
  id: string;
  email: string;
  name: string;
  createdAt: Date;
}> = [];
let featureFixtures: FeatureFixture[] = [];
let runtimeFixtures: RuntimeFixture[] = [];
let auditFixtures: AuditFixture[] = [];
let oauthUsageFixtures: OAuthUsageFixture[] = [];

function shanghaiDateKey(value: Date): string {
  return new Date(value.getTime() + shanghaiOffset).toISOString().slice(0, 10);
}
describe("Prometheus aggregate projection policies", () => {
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

    userFixtures = [
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
    ];
    await fixturePrisma.user.createMany({ data: userFixtures });

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

  it("preserves current-state summaries, rolling clients and audit policy exclusions", async () => {
    const snapshot = await readPrometheusMetrics();
    expect(snapshot.summary).toEqual({
      users: baseline.summary.users + 2,
      comments: baseline.summary.comments + 1,
      homeworks: baseline.summary.homeworks + 1,
      oauthClients: baseline.summary.oauthClients + 2,
      activeSuspensions: baseline.summary.activeSuspensions + 1,
    });
    expect(snapshot.registrations - baseline.registrations).toBe(2);
    for (const fixture of auditFixtures) {
      const count = (value: typeof snapshot) =>
        value.audit.find(
          (row) =>
            row.action === fixture.action &&
            row.channel === fixture.channel &&
            row.outcome === fixture.outcome,
        )?.events ?? 0;
      expect(count(snapshot) - count(baseline)).toBe(fixture.included ? 1 : 0);
    }
    const usage = (value: typeof snapshot) =>
      value.oauth.find(
        (row) => row.channel === "mcp" && row.feature === "account.profile",
      );
    for (const field of ["readCount", "writeCount", "errorCount"] as const)
      expect(
        (usage(snapshot)?.[field] ?? 0) - (usage(baseline)?.[field] ?? 0),
      ).toBe(oauthUsageFixtures.reduce((sum, row) => sum + row[field], 0));
    // All fixture daily rows have a recent lastUsedAt, including an old day row.
    for (const window of ["24h", "7d", "30d"] as const) {
      const current =
        snapshot.oauthSummary.find((row) => row.window === window)
          ?.activeClients ?? 0;
      const previous =
        baseline.oauthSummary.find((row) => row.window === window)
          ?.activeClients ?? 0;
      expect(current - previous).toBe(2);
    }
  });
  it("projects all committed feature and runtime observations independently of their event dates", async () => {
    const snapshot = await readPrometheusMetrics();
    for (const fixture of featureFixtures) {
      const matches = (row: (typeof snapshot.features)[number]) =>
        row.feature === fixture.feature &&
        row.operation === fixture.operation &&
        row.protocol === fixture.protocol &&
        row.surface === fixture.surface &&
        row.authMode === fixture.authMode &&
        row.outcome === fixture.outcome;
      const expected = featureFixtures.filter((row) =>
        matches({ ...row, events: 1 }),
      ).length;
      expect(
        (snapshot.features.find(matches)?.events ?? 0) -
          (baseline.features.find(matches)?.events ?? 0),
      ).toBe(expected);
    }
    const runtimeCount = (value: typeof snapshot) =>
      value.runtime.find(
        (row) =>
          row.level === "error" &&
          row.event === "other" &&
          row.status === "5xx",
      )?.events ?? 0;
    expect(runtimeCount(snapshot) - runtimeCount(baseline)).toBe(
      runtimeFixtures.length,
    );
  });
  it("does not grant runtime access to cached activity rows", async () => {
    await expect(
      runtimePrisma.$queryRaw`SELECT id FROM public."PrometheusMetricsCache"`,
    ).rejects.toThrow();
  });
});
