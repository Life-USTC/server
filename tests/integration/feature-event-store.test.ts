import { describe, expect } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import {
  type FeatureEventInput,
  type RuntimeIssueInput,
  writeObservabilityBatch,
} from "@/lib/db/feature-event-store";
import { prisma as runtimePrisma, withUserDbContext } from "@/lib/db/prisma";
import { withRuntimeDatabaseAdapter } from "@/lib/db/prisma-adapter";
import { workspaceRuntimeTest as it } from "../shared/workspace-state-fixture";

describe("self-hosted observability event store", () => {
  function featureInput(
    overrides: Partial<FeatureEventInput> = {},
  ): FeatureEventInput {
    return {
      id: crypto.randomUUID(),
      feature: "catalog.search",
      operation: "search",
      protocol: "web",
      surface: "web",
      authMode: "anonymous",
      outcome: "success",
      errorClass: "none",
      durationMs: 12.5,
      ...overrides,
    };
  }
  function issueInput(
    overrides: Partial<RuntimeIssueInput> = {},
  ): RuntimeIssueInput {
    return { id: crypto.randomUUID(), level: "error", event: "api.request.error", ...overrides };
  }

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
    { tags: ["@Database/Permissions"] },
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

  it("rolls back a valid feature when its issue fails, then safely replays the corrected mixed batch", {
    tags: ["@Infrastructure/Service"],
  }, async ({ isolatedDatabase, workspaceRuntime }) => {
    const { owner: fixturePrisma } = isolatedDatabase;
    await workspaceRuntime.run(async () => {
      const feature = featureInput();
      const issue = issueInput({ status: 600 });
      await expect(
        writeObservabilityBatch({ features: [feature], issues: [issue] }),
      ).rejects.toThrow();
      expect(
        await fixturePrisma.featureOperationEvent.count({
          where: { id: feature.id },
        }),
      ).toBe(0);
      expect(
        await fixturePrisma.runtimeIssueEvent.count({
          where: { id: issue.id },
        }),
      ).toBe(0);
      const corrected = { ...issue, status: 500 };
      await writeObservabilityBatch({
        features: [feature],
        issues: [corrected],
      });
      await writeObservabilityBatch({
        features: [feature],
        issues: [corrected],
      });
      expect(
        await fixturePrisma.featureOperationEvent.count({
          where: { id: feature.id },
        }),
      ).toBe(1);
      expect(
        await fixturePrisma.runtimeIssueEvent.count({
          where: { id: issue.id },
        }),
      ).toBe(1);
    });
  });

  it("preserves millisecond timestamps, database date defaults, and null optional fields", {
    tags: ["@Infrastructure/Service"],
  }, async ({ isolatedDatabase, workspaceRuntime }) => {
    const { owner: fixturePrisma } = isolatedDatabase;
    await workspaceRuntime.run(async () => {
      const occurredAt = new Date("2026-10-11T12:13:14.567+08:00");
      const explicit = featureInput({
        occurredAt,
        requestId: null,
        userId: null,
        durationMs: 0.123456789,
      });
      const defaulted = featureInput();
      const nullDate = featureInput({ occurredAt: null as unknown as Date });
      const explicitIssue = issueInput({
        occurredAt,
        requestId: null,
        route: null,
        status: null,
      });
      const defaultedIssue = issueInput();
      const nullDateIssue = issueInput({
        occurredAt: null as unknown as Date,
      });
      await writeObservabilityBatch({
        features: [explicit, defaulted, nullDate],
        issues: [explicitIssue, defaultedIssue, nullDateIssue],
      });
      const featureRow =
        await fixturePrisma.featureOperationEvent.findUniqueOrThrow({
          where: { id: explicit.id },
        });
      expect(featureRow).toMatchObject({
        occurredAt: new Date("2026-10-11T04:13:14.567Z"),
        requestId: null,
        userId: null,
        durationMs: 0.123456789,
      });
      const issueRow = await fixturePrisma.runtimeIssueEvent.findUniqueOrThrow({
        where: { id: explicitIssue.id },
      });
      expect(issueRow).toMatchObject({
        occurredAt: new Date("2026-10-11T04:13:14.567Z"),
        requestId: null,
        route: null,
        status: null,
      });
      for (const value of [defaulted, nullDate]) {
        const row =
          await fixturePrisma.featureOperationEvent.findUniqueOrThrow({
            where: { id: value.id },
          });
        expect(row.occurredAt).toEqual(row.createdAt);
        expect(row.occurredAt.getUTCFullYear()).toBeGreaterThan(2025);
        expect(row).toMatchObject({ requestId: null, userId: null });
      }
      for (const value of [defaultedIssue, nullDateIssue]) {
        const row = await fixturePrisma.runtimeIssueEvent.findUniqueOrThrow({
          where: { id: value.id },
        });
        expect(row.occurredAt).toEqual(row.createdAt);
        expect(row.occurredAt.getUTCFullYear()).toBeGreaterThan(2025);
        expect(row).toMatchObject({ requestId: null, route: null, status: null });
      }
    });
  });

  it("rejects invalid values rather than letting JSON or SQL coerce them into valid observations", {
    tags: ["@Infrastructure/Service"],
  }, async ({ isolatedDatabase, workspaceRuntime }) => {
    const { owner: fixturePrisma } = isolatedDatabase;
    await workspaceRuntime.run(async () => {
      for (const durationMs of [
        Number.NaN,
        Number.POSITIVE_INFINITY,
        Number.NEGATIVE_INFINITY,
        -1,
      ]) {
        const feature = featureInput({ durationMs });
        await expect(
          writeObservabilityBatch({ features: [feature] }),
        ).rejects.toThrow();
        expect(
          await fixturePrisma.featureOperationEvent.count({
            where: { id: feature.id },
          }),
        ).toBe(0);
      }
      for (const status of [
        Number.NaN,
        Number.POSITIVE_INFINITY,
        500.5,
        2 ** 31,
      ]) {
        const issue = issueInput({ status });
        await expect(
          writeObservabilityBatch({ issues: [issue] }),
        ).rejects.toThrow();
        expect(
          await fixturePrisma.runtimeIssueEvent.count({
            where: { id: issue.id },
          }),
        ).toBe(0);
      }
      const invalidDate = new Date(Number.NaN);
      const feature = featureInput({ occurredAt: invalidDate });
      const issue = issueInput({ occurredAt: invalidDate });
      await expect(
        writeObservabilityBatch({ features: [feature] }),
      ).rejects.toThrow();
      await expect(
        writeObservabilityBatch({ issues: [issue] }),
      ).rejects.toThrow();
      expect(
        await fixturePrisma.featureOperationEvent.count({
          where: { id: feature.id },
        }),
      ).toBe(0);
      expect(
        await fixturePrisma.runtimeIssueEvent.count({
          where: { id: issue.id },
        }),
      ).toBe(0);
    });
  });

  it("writes using the app role while keeping anonymous reads and mutations restricted", {
    tags: ["@Infrastructure/Service"],
  }, async ({ isolatedDatabase, workspaceRuntime }) => {
    const { owner: fixturePrisma } = isolatedDatabase;
    await workspaceRuntime.run(async () => {
      const regularUserId = `event-user-${crypto.randomUUID()}`;
      await fixturePrisma.user.create({
        data: { id: regularUserId, email: `${regularUserId}@test.invalid` },
      });
      const feature = featureInput({ userId: regularUserId });
      const issue = issueInput();
      await writeObservabilityBatch({ features: [feature], issues: [issue] });
      await withRuntimeDatabaseAdapter("app", async (adapter) => {
        const role = await adapter.queryRaw({
          sql: "SELECT current_user::text",
          args: [],
          argTypes: [],
        });
        expect(role.rows).toEqual([["life_ustc_runtime"]]);
        const featureRows = await adapter.queryRaw({
          sql: 'SELECT "id" FROM "FeatureOperationEvent" WHERE "id" = $1',
          args: [feature.id],
          argTypes: [{ scalarType: "string", arity: "scalar" }],
        });
        const issueRows = await adapter.queryRaw({
          sql: 'SELECT "id" FROM "RuntimeIssueEvent" WHERE "id" = $1',
          args: [issue.id],
          argTypes: [{ scalarType: "string", arity: "scalar" }],
        });
        expect(featureRows.rows).toEqual([]);
        expect(issueRows.rows).toEqual([]);
        await expect(
          adapter.executeRaw({
            sql: 'DELETE FROM "FeatureOperationEvent" WHERE "id" = $1',
            args: [feature.id],
            argTypes: [{ scalarType: "string", arity: "scalar" }],
          }),
        ).rejects.toThrow();
      });
      expect(
        await fixturePrisma.featureOperationEvent.findUnique({
          where: { id: feature.id },
        }),
      ).toMatchObject({ userId: regularUserId });
      expect(
        await fixturePrisma.runtimeIssueEvent.count({
          where: { id: issue.id },
        }),
      ).toBe(1);
    });
  });
});
