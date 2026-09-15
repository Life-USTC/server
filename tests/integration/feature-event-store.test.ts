import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { writeObservabilityBatch } from "@/lib/db/feature-event-store";
import { prisma as runtimePrisma, withUserDbContext } from "@/lib/db/prisma";
import { createFixturePrisma, disconnectTestPrisma } from "../shared/prisma";

const fixturePrisma = createFixturePrisma();
const marker = `feature-event-${crypto.randomUUID()}`;

describe("self-hosted observability event store", { concurrent: false }, () => {
  let adminUserId = "";
  let regularUserId = "";
  const featureEventIds = [
    "33333333-3333-4333-8333-333333333333",
    "44444444-4444-4444-8444-444444444444",
  ];
  const issueEventId = "55555555-5555-4555-8555-555555555555";

  beforeAll(async () => {
    const [admin, regular] = await Promise.all([
      fixturePrisma.user.create({
        data: {
          email: `${marker}-admin@example.test`,
          isAdmin: true,
          name: `${marker}-admin`,
        },
        select: { id: true },
      }),
      fixturePrisma.user.create({
        data: {
          email: `${marker}-user@example.test`,
          name: `${marker}-user`,
        },
        select: { id: true },
      }),
    ]);
    adminUserId = admin.id;
    regularUserId = regular.id;
  });

  afterAll(async () => {
    await fixturePrisma.featureOperationEvent.deleteMany({
      where: { id: { in: featureEventIds } },
    });
    await fixturePrisma.runtimeIssueEvent.deleteMany({
      where: { id: issueEventId },
    });
    await fixturePrisma.user.deleteMany({
      where: { id: { in: [adminUserId, regularUserId] } },
    });
    await Promise.all([
      runtimePrisma.$disconnect(),
      disconnectTestPrisma(fixturePrisma),
    ]);
  });

  it("is idempotent for replayed feature and issue event IDs", async () => {
    const feature = {
      id: featureEventIds[0],
      feature: "catalog.search",
      operation: "search",
      protocol: "web",
      surface: "web",
      authMode: "anonymous",
      outcome: "success",
      errorClass: "none",
      durationMs: 12.5,
      userId: regularUserId,
    } as const;
    const issue = {
      id: issueEventId,
      level: "error" as const,
      event: "api.request.error",
      route: "/api/search",
      status: 500,
    };

    await writeObservabilityBatch({ features: [feature], issues: [issue] });
    await writeObservabilityBatch({ features: [feature], issues: [issue] });

    await expect(
      fixturePrisma.featureOperationEvent.count({
        where: { id: feature.id },
      }),
    ).resolves.toBe(1);
    await expect(
      fixturePrisma.runtimeIssueEvent.count({ where: { id: issue.id } }),
    ).resolves.toBe(1);
  });

  it("rejects invalid dimensions and non-finite or negative durations", async () => {
    const base = {
      id: featureEventIds[1],
      feature: "catalog.search",
      operation: "search",
      protocol: "web",
      surface: "web",
      authMode: "anonymous",
      outcome: "success",
      errorClass: "none",
      durationMs: 1,
    };

    await expect(
      fixturePrisma.featureOperationEvent.create({
        data: { ...base, feature: "not-a-feature" },
      }),
    ).rejects.toThrow();
    await expect(
      fixturePrisma.featureOperationEvent.create({
        data: { ...base, durationMs: -1 },
      }),
    ).rejects.toThrow();
    await expect(
      fixturePrisma.featureOperationEvent.create({
        data: { ...base, durationMs: Number.NaN },
      }),
    ).rejects.toThrow();
  });

  it("deletes both event types in bounded ninety-day retention batches", async () => {
    const oldFeatureId = crypto.randomUUID();
    const oldIssueId = crypto.randomUUID();
    const old = new Date("2025-01-01T00:00:00.000Z");
    await fixturePrisma.featureOperationEvent.create({
      data: {
        id: oldFeatureId,
        occurredAt: old,
        feature: "catalog.search",
        operation: "search",
        protocol: "web",
        surface: "web",
        authMode: "anonymous",
        outcome: "success",
        errorClass: "none",
        durationMs: 1,
      },
    });
    await fixturePrisma.runtimeIssueEvent.create({
      data: {
        id: oldIssueId,
        occurredAt: old,
        level: "warn",
        event: "page.request.error",
      },
    });

    const [report] = await fixturePrisma.$queryRaw<
      Array<{ feature_rows_deleted: bigint; issue_rows_deleted: bigint }>
    >(Prisma.sql`
      SELECT * FROM public.maintain_observability_event_retention(
        ${new Date("2026-01-01T00:00:00.000Z")},
        ${1}
      )
    `);
    expect(report).toEqual({
      feature_rows_deleted: 1n,
      issue_rows_deleted: 1n,
    });
  });

  it.skipIf(process.env.RLS_TEST_ENABLED !== "true")(
    "allows only administrators to read event rows through the app RLS role",
    async () => {
      const adminRows = await withUserDbContext(adminUserId, (tx) =>
        tx.featureOperationEvent.findMany({
          where: { id: featureEventIds[0] },
          select: { id: true },
        }),
      );
      const regularRows = await withUserDbContext(regularUserId, (tx) =>
        tx.featureOperationEvent.findMany({
          where: { id: featureEventIds[0] },
          select: { id: true },
        }),
      );
      const anonymousRows = await runtimePrisma.featureOperationEvent.findMany({
        where: { id: featureEventIds[0] },
        select: { id: true },
      });

      expect(adminRows).toEqual([{ id: featureEventIds[0] }]);
      expect(regularRows).toEqual([]);
      expect(anonymousRows).toEqual([]);
    },
  );
});
