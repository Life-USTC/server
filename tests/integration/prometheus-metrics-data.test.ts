import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readPrometheusMetrics } from "@/features/admin/server/prometheus-metrics-data";
import { Prisma } from "@/generated/prisma/client";
import { prisma as runtimePrisma } from "@/lib/db/prisma";
import { createFixturePrisma, disconnectTestPrisma } from "../shared/prisma";

const fixturePrisma = createFixturePrisma();
const marker = `prometheus-metrics-${crypto.randomUUID()}`;
const day = 24 * 60 * 60 * 1000;

describe("Prometheus metrics data layer", () => {
  let baseline: Awaited<ReturnType<typeof readPrometheusMetrics>>;
  let userIds: string[] = [];
  const eventIds = [
    crypto.randomUUID(),
    crypto.randomUUID(),
    crypto.randomUUID(),
    crypto.randomUUID(),
  ];
  const runtimeIssueIds = [crypto.randomUUID(), crypto.randomUUID()];

  beforeAll(async () => {
    await fixturePrisma.$executeRaw`DELETE FROM public."PrometheusMetricsCache"`;
    baseline = await readPrometheusMetrics();
    const users = await Promise.all(
      ["one", "two"].map((suffix) =>
        fixturePrisma.user.create({
          data: {
            email: `${marker}-${suffix}@example.test`,
            name: `${marker}-${suffix}`,
          },
          select: { id: true },
        }),
      ),
    );
    userIds = users.map(({ id }) => id);

    const now = new Date();
    await fixturePrisma.featureOperationEvent.createMany({
      data: [
        {
          id: eventIds[0],
          occurredAt: new Date(now.getTime() - 60_000),
          feature: "catalog.search",
          operation: "search",
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
          occurredAt: new Date(now.getTime() - 120_000),
          feature: "catalog.search",
          operation: "search",
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
          occurredAt: new Date(now.getTime() - 8 * day),
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
          occurredAt: new Date(now.getTime() - 40 * day),
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
      ],
    });
    await fixturePrisma.runtimeIssueEvent.createMany({
      data: [
        {
          id: runtimeIssueIds[0],
          occurredAt: new Date(now.getTime() - 60_000),
          level: "error",
          event: "prometheus-test.issue",
          status: 503,
        },
        {
          id: runtimeIssueIds[1],
          occurredAt: new Date(now.getTime() - 40 * day),
          level: "error",
          event: "prometheus-test.issue",
          status: 503,
        },
      ],
    });

    await fixturePrisma.$executeRaw`
        DELETE FROM public."PrometheusMetricsCache"
      `;
  });

  afterAll(async () => {
    await fixturePrisma.runtimeIssueEvent.deleteMany({
      where: { id: { in: runtimeIssueIds } },
    });
    await fixturePrisma.featureOperationEvent.deleteMany({
      where: { id: { in: eventIds } },
    });
    await fixturePrisma.$executeRaw`
        DELETE FROM public."PrometheusMetricsCache"
      `;
    await fixturePrisma.user.deleteMany({ where: { id: { in: userIds } } });
    await Promise.all([
      runtimePrisma.$disconnect(),
      disconnectTestPrisma(fixturePrisma),
    ]);
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
        row.feature === "catalog.search" &&
        row.operation === "search" &&
        row.protocol === "mcp" &&
        row.surface === "mcp" &&
        row.authMode === "oauth" &&
        row.outcome === "success" &&
        row.errorClass === "none",
    );
    expect(recent).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          window: "5m",
          events: 2,
          users: 2,
          durationSeconds: 3,
          maxDurationSeconds: 2,
        }),
        expect.objectContaining({
          window: "today",
          events: 2,
          users: 2,
          durationSeconds: 3,
          maxDurationSeconds: 2,
        }),
        expect.objectContaining({
          window: "7d",
          events: 2,
          users: 2,
          durationSeconds: 3,
          maxDurationSeconds: 2,
        }),
        expect.objectContaining({
          window: "30d",
          events: 2,
          users: 2,
          durationSeconds: 3,
          maxDurationSeconds: 2,
        }),
      ]),
    );

    const expiredFromShortWindows = first.features.filter(
      (row) =>
        row.feature === "workspace.subscription" &&
        row.operation === "list" &&
        row.protocol === "graphql" &&
        row.surface === "unknown" &&
        row.authMode === "session" &&
        row.outcome === "rejected" &&
        row.errorClass === "unauthorized",
    );
    expect(expiredFromShortWindows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          window: "5m",
          events: 0,
          users: 0,
          durationSeconds: 0,
          maxDurationSeconds: 0,
        }),
        expect.objectContaining({
          window: "today",
          events: 0,
          users: 0,
          durationSeconds: 0,
          maxDurationSeconds: 0,
        }),
        expect.objectContaining({
          window: "7d",
          events: 0,
          users: 0,
          durationSeconds: 0,
          maxDurationSeconds: 0,
        }),
        expect.objectContaining({
          window: "30d",
          events: 1,
          users: 1,
          durationSeconds: 0.5,
          maxDurationSeconds: 0.5,
        }),
      ]),
    );

    const retainedCourseRows = (snapshot: typeof first) =>
      snapshot.features.filter(
        (row) =>
          row.feature === "catalog.course" &&
          row.operation === "get" &&
          row.protocol === "rest",
      );
    expect(retainedCourseRows(first)).toEqual(retainedCourseRows(baseline));
    expect(
      first.runtime.filter(
        (row) =>
          row.window === "30d" &&
          row.level === "error" &&
          row.event === "other" &&
          row.status === "5xx",
      ),
    ).toEqual([
      expect.objectContaining({
        events:
          1 +
          (baseline.runtime.find(
            (row) =>
              row.window === "30d" &&
              row.level === "error" &&
              row.event === "other" &&
              row.status === "5xx",
          )?.events ?? 0),
      }),
    ]);
  });

  it("does not grant the runtime role direct access to raw cache rows", async () => {
    await expect(
      runtimePrisma.$queryRaw(Prisma.sql`
          SELECT "id" FROM public."PrometheusMetricsCache"
        `),
    ).rejects.toThrow();
  });
});
