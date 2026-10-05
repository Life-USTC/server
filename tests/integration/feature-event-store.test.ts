import { describe, expect } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { writeObservabilityBatch } from "@/lib/db/feature-event-store";
import { prisma as runtimePrisma, withUserDbContext } from "@/lib/db/prisma";
import { workspaceRuntimeTest as it } from "../shared/workspace-state-fixture";

describe("self-hosted observability event store", () => {
  it("is idempotent for replayed feature and issue event IDs", {
    tags: ["@Infrastructure/Service"],
  }, async ({ isolatedDatabase, workspaceRuntime }) => {
    const { owner: fixturePrisma } = isolatedDatabase;
    await workspaceRuntime.run(async () => {
      const regularUserId = `event-user-${crypto.randomUUID()}`;
      await fixturePrisma.user.create({
        data: {
          id: regularUserId,
          email: `${regularUserId}@test.invalid`,
        },
      });
      const feature = {
        id: crypto.randomUUID(),
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
        id: crypto.randomUUID(),
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
  });

  it("rejects invalid dimensions and non-finite or negative durations", {
    tags: ["@Infrastructure/Service"],
  }, async ({ isolatedDatabase, workspaceRuntime }) => {
    const { owner: fixturePrisma } = isolatedDatabase;
    await workspaceRuntime.run(async () => {
      const base = {
        id: crypto.randomUUID(),
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
  });

  it("deletes both event types in bounded ninety-day retention batches", {
    tags: ["@Infrastructure/Service"],
  }, async ({ isolatedDatabase, workspaceRuntime }) => {
    const { owner: fixturePrisma } = isolatedDatabase;
    await workspaceRuntime.run(async () => {
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
  });

  it.skipIf(process.env.RLS_TEST_ENABLED !== "true")(
    "allows only administrators to read event rows through the app RLS role",
    async ({ isolatedDatabase, workspaceRuntime }) => {
      const { owner: fixturePrisma } = isolatedDatabase;
      await workspaceRuntime.run(async () => {
        const adminUserId = `event-admin-${crypto.randomUUID()}`;
        const regularUserId = `event-user-${crypto.randomUUID()}`;
        const featureEventId = crypto.randomUUID();
        // Consumer permissions require an independently prepared event. This
        // case must also pass when the idempotent writer case is not selected.
        await fixturePrisma.$transaction(async (tx) => {
          await tx.user.createMany({
            data: [
              {
                id: adminUserId,
                email: `${adminUserId}@test.invalid`,
                isAdmin: true,
              },
              { id: regularUserId, email: `${regularUserId}@test.invalid` },
            ],
          });
          await tx.featureOperationEvent.create({
            data: {
              id: featureEventId,
              userId: regularUserId,
              feature: "catalog.search",
              operation: "search",
              protocol: "web",
              surface: "web",
              authMode: "anonymous",
              outcome: "success",
              errorClass: "none",
              durationMs: 12.5,
            },
          });
        });
        const adminRows = await withUserDbContext(adminUserId, (tx) =>
          tx.featureOperationEvent.findMany({
            where: { id: featureEventId },
            select: { id: true },
          }),
        );
        const regularRows = await withUserDbContext(regularUserId, (tx) =>
          tx.featureOperationEvent.findMany({
            where: { id: featureEventId },
            select: { id: true },
          }),
        );
        const anonymousRows =
          await runtimePrisma.featureOperationEvent.findMany({
            where: { id: featureEventId },
            select: { id: true },
          });

        expect(adminRows).toEqual([{ id: featureEventId }]);
        expect(regularRows).toEqual([]);
        expect(anonymousRows).toEqual([]);
      });
    },
  );
});
