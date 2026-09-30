import { expect } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { metricsTest } from "../shared/metrics-fixture";
import type { TestPrismaClient } from "../shared/prisma";

const day = 86_400_000;
const shanghaiOffset = 8 * 60 * 60 * 1000;
function shanghaiDateKey(value: Date): string {
  return new Date(value.getTime() + shanghaiOffset).toISOString().slice(0, 10);
}

async function prepareProjection(fixturePrisma: TestPrismaClient) {
  const marker = `prometheus-metrics-${crypto.randomUUID()}`;

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
  const clientIds = [
    `${marker}-client-current`,
    `${marker}-client-old`,
  ] as const;
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

  const referenceRow = (
    await fixturePrisma.$queryRaw<{ now: Date }[]>(
      Prisma.sql`SELECT statement_timestamp() AS now`,
    )
  )[0];
  if (!referenceRow) {
    throw new Error("Unable to establish the fixture database timestamp");
  }
  const referenceNow = referenceRow.now;

  const recentA = new Date(referenceNow.getTime() - 30_000);
  const recentB = new Date(referenceNow.getTime() - 60_000);
  const eightDaysAgo = new Date(referenceNow.getTime() - 8 * day);
  const fortyDaysAgo = new Date(referenceNow.getTime() - 40 * day);

  const userFixtures: Prisma.UserCreateManyInput[] = [
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

  const featureFixtures: Prisma.FeatureOperationEventCreateManyInput[] = [
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

  const runtimeFixtures: Prisma.RuntimeIssueEventCreateManyInput[] = [
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

  const section = await fixturePrisma.section.create({
    data: {
      jwId: 1,
      code: "METRICS-SECTION",
      course: {
        create: { jwId: 1, code: "METRICS", nameCn: "Metrics fixture" },
      },
    },
  });

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

  const auditFixtures: Prisma.AuditLogCreateManyInput[] = [
    {
      id: auditIds[0],
      action: "admin_user_suspend",
      channel: "web",
      outcome: "success",
      createdAt: recentA,
    },
    {
      id: auditIds[1],
      action: "admin_user_unsuspend",
      channel: "system",
      outcome: "failure",
      createdAt: eightDaysAgo,
    },
    {
      id: auditIds[2],
      action: "oauth_authorization_grant",
      channel: "mcp",
      outcome: "success",
      createdAt: recentA,
      oauthClientId: clientIds[0],
    },
    {
      id: auditIds[3],
      action: "oauth_authorization_update",
      channel: "auth",
      outcome: "success",
      createdAt: recentB,
      oauthClientId: clientIds[0],
    },
    {
      id: auditIds[4],
      action: "admin_bus_import",
      channel: "system",
      outcome: "failure",
      createdAt: fortyDaysAgo,
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
  const oauthUsageFixtures = [
    {
      id: oauthUsageIds[0],
      userId: userIds[0],
      clientId: clientIds[0],
      day: today,
      feature: "account.profile",
      channel: "mcp" as const,
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
      channel: "mcp" as const,
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
      channel: "mcp" as const,
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
}

const it = metricsTest.extend<{ projection: undefined }>({
  projection: async ({ metrics }, use) => {
    await metrics.run(() => prepareProjection(metrics.db));
    await use(undefined);
  },
});

it("preserves current-state summaries, rolling clients and audit policy exclusions", async ({
  projection: _projection,
  metrics: { run, read },
}) => {
  await run(async () => {
    const snapshot = await read();
    expect(snapshot.summary).toEqual({
      users: 2,
      comments: 1,
      homeworks: 1,
      oauthClients: 2,
      activeSuspensions: 1,
    });
    expect(snapshot.registrations).toBe(2);
    expect(snapshot.audit).toHaveLength(4);
    expect(snapshot.audit).toEqual(
      expect.arrayContaining([
        {
          action: "admin_user_suspend",
          channel: "web",
          outcome: "success",
          events: 1,
        },
        {
          action: "admin_user_unsuspend",
          channel: "system",
          outcome: "failure",
          events: 1,
        },
        {
          action: "oauth_authorization_update",
          channel: "auth",
          outcome: "success",
          events: 1,
        },
        {
          action: "admin_bus_import",
          channel: "system",
          outcome: "failure",
          events: 1,
        },
      ]),
    );
    expect(
      snapshot.audit.some((row) => row.action === "oauth_authorization_grant"),
    ).toBe(false);
    expect(snapshot.oauth).toEqual([
      {
        channel: "mcp",
        feature: "account.profile",
        readCount: 111,
        writeCount: 104,
        errorCount: 104,
      },
    ]);
    // Activity follows lastUsedAt, including the 40-day-old daily row used now.
    expect(snapshot.oauthSummary).toHaveLength(3);
    expect(snapshot.oauthSummary).toEqual(
      expect.arrayContaining([
        { window: "24h", activeClients: 2 },
        { window: "7d", activeClients: 2 },
        { window: "30d", activeClients: 2 },
      ]),
    );
  });
});

it("projects all committed feature and runtime observations independently of their event dates", async ({
  projection: _projection,
  metrics: { run, read },
}) => {
  await run(async () => {
    const snapshot = await read();
    expect(snapshot.features).toHaveLength(3);
    expect(snapshot.features).toEqual(
      expect.arrayContaining([
        {
          feature: "catalog.search",
          operation: "search",
          protocol: "mcp",
          surface: "mcp",
          authMode: "oauth",
          outcome: "success",
          events: 2,
        },
        {
          feature: "workspace.subscription",
          operation: "list",
          protocol: "graphql",
          surface: "unknown",
          authMode: "session",
          outcome: "rejected",
          events: 1,
        },
        {
          feature: "catalog.course",
          operation: "get",
          protocol: "rest",
          surface: "web",
          authMode: "anonymous",
          outcome: "success",
          events: 1,
        },
      ]),
    );
    // Rejected requests are counted as outcomes, not server-error events.
    expect(snapshot.featureErrors).toEqual([]);
    expect(snapshot.runtime).toEqual([
      { level: "error", event: "other", status: "5xx", events: 2 },
    ]);
  });
});

it("does not grant runtime access to cached activity rows", async ({
  metrics: { run, app },
}) => {
  await run(async () => {
    await expect(
      app.$queryRaw`SELECT id FROM public."PrometheusMetricsCache"`,
    ).rejects.toThrow(/permission denied/i);
  });
});
