import { afterAll, describe, expect, it } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { createFixturePrisma, disconnectTestPrisma } from "../shared/prisma";

const adminPrisma = createFixturePrisma();

const publicationIngestionTables = [
  "IngestionBatch",
  "IngestionBatchObject",
  "IngestionRun",
  "Publication",
  "PublicationEventOutbox",
  "PublicationImageSource",
  "PublicationObject",
  "PublicationObjectLink",
  "PublicationRevision",
  "PublicationRevisionImageSource",
  "PublicationSource",
] as const;

describe.skipIf(
  process.env.RLS_TEST_ENABLED !== "true" || adminPrisma === null,
)("publication ingestion PostgreSQL row security", () => {
  type FixtureIds = {
    batchId: string;
    batchObjectId: string;
    eventId: string;
    linkId: string;
    objectId: string;
    publicationId: string;
    revisionId: string;
    runId: string;
    sourceId: string;
  };

  async function deleteFixture(ids: FixtureIds) {
    await adminPrisma.$transaction(async (tx) => {
      await tx.publication.deleteMany({ where: { id: ids.publicationId } });
      await tx.publicationObject.deleteMany({ where: { id: ids.objectId } });
      await tx.ingestionBatch.deleteMany({ where: { id: ids.batchId } });
      await tx.ingestionRun.deleteMany({ where: { id: ids.runId } });
      await tx.publicationEventOutbox.deleteMany({
        where: { id: ids.eventId },
      });
      await tx.publicationSource.deleteMany({ where: { id: ids.sourceId } });
      // These child rows should already have cascaded; clean by explicit ID as
      // well so this helper also handles a fixture that failed mid-arrange.
      await tx.publicationObjectLink.deleteMany({ where: { id: ids.linkId } });
      await tx.ingestionBatchObject.deleteMany({
        where: { id: ids.batchObjectId },
      });
      await tx.publicationRevision.deleteMany({
        where: { id: ids.revisionId },
      });
    });
  }

  afterAll(async () => {
    await Promise.all([
      prisma.$disconnect(),
      disconnectTestPrisma(adminPrisma),
    ]);
  });

  it("keeps ingestion tables behind the app runtime policy and write grant", async () => {
    const rows = await adminPrisma.$queryRaw<
      Array<{
        deleteGranted: boolean;
        insertGranted: boolean;
        policyCount: bigint;
        policyName: string | null;
        relForceRowSecurity: boolean;
        relRowSecurity: boolean;
        selectGranted: boolean;
        tableName: string;
        updateGranted: boolean;
      }>
    >(Prisma.sql`
        SELECT
          c.relname AS "tableName",
          c.relrowsecurity AS "relRowSecurity",
          c.relforcerowsecurity AS "relForceRowSecurity",
          count(p.policyname) FILTER (
            WHERE p.policyname = c.relname || '_runtime_access'
          ) AS "policyCount",
          max(p.policyname) FILTER (
            WHERE p.policyname = c.relname || '_runtime_access'
          ) AS "policyName",
          has_table_privilege(
            'life_ustc_runtime', format('public.%I', c.relname), 'SELECT'
          ) AS "selectGranted",
          has_table_privilege(
            'life_ustc_runtime', format('public.%I', c.relname), 'INSERT'
          ) AS "insertGranted",
          has_table_privilege(
            'life_ustc_runtime', format('public.%I', c.relname), 'UPDATE'
          ) AS "updateGranted",
          has_table_privilege(
            'life_ustc_runtime', format('public.%I', c.relname), 'DELETE'
          ) AS "deleteGranted"
        FROM pg_class AS c
        JOIN pg_namespace AS n ON n.oid = c.relnamespace
        LEFT JOIN pg_policies AS p
          ON p.schemaname = n.nspname
          AND p.tablename = c.relname
        WHERE n.nspname = 'public'
          AND c.relname IN (${Prisma.join(publicationIngestionTables)})
        GROUP BY c.relname, c.relrowsecurity, c.relforcerowsecurity
        ORDER BY c.relname
      `);

    expect(rows).toHaveLength(publicationIngestionTables.length);
    expect(rows.map(({ tableName }) => tableName)).toEqual([
      ...publicationIngestionTables,
    ]);
    for (const row of rows) {
      expect(row).toMatchObject({
        deleteGranted: false,
        insertGranted: true,
        policyCount: 1n,
        relForceRowSecurity: false,
        relRowSecurity: true,
        selectGranted: true,
        updateGranted: true,
        policyName: `${row.tableName}_runtime_access`,
      });
    }
  });

  it("allows runtime SELECT/INSERT/UPDATE and rejects runtime DELETE", async () => {
    const suffix = crypto.randomUUID();
    const ids: FixtureIds = {
      batchId: `rls-publication-batch-${suffix}`,
      batchObjectId: `rls-publication-batch-object-${suffix}`,
      eventId: `rls-publication-event-${suffix}`,
      linkId: `rls-publication-link-${suffix}`,
      objectId: `rls-publication-object-${suffix}`,
      publicationId: `rls-publication-${suffix}`,
      revisionId: `rls-publication-revision-${suffix}`,
      runId: `rls-publication-run-${suffix}`,
      sourceId: `rls-publication-source-${suffix}`,
    };
    const observedAt = new Date("2026-09-14T08:00:00.000Z");

    try {
      await prisma.$transaction(async (tx) => {
        await tx.publicationSource.create({
          data: {
            id: ids.sourceId,
            name: `[integration-test] RLS publication source ${suffix}`,
            organizationLevel: "university",
            allowedHosts: [],
            blockedHosts: [],
            seedUrls: [],
            aliases: [],
            discoveryOnly: false,
            maxImagesPerPage: null,
            enabled: true,
          },
        });
        await tx.ingestionRun.create({
          data: {
            id: ids.runId,
            clientRunId: `rls-publication-client-run-${suffix}`,
            principalKey: `service:rls-${suffix}`,
            observedAt,
          },
        });
        await tx.publicationObject.create({
          data: {
            id: ids.objectId,
            sha256: `rls-publication-sha-${suffix}`,
            kind: "body_html",
            size: 1,
            contentType: "text/html",
            r2Key: `publication/objects/rls-${suffix}`,
          },
        });
        await tx.publication.create({
          data: {
            id: ids.publicationId,
            sourceId: ids.sourceId,
            canonicalUrl: `https://rls-publication-${suffix}.test/article`,
            title: "RLS publication before update",
            publicationType: "news",
            firstSeenAt: observedAt,
            lastSeenAt: observedAt,
          },
        });
        await tx.publicationRevision.create({
          data: {
            id: ids.revisionId,
            publicationId: ids.publicationId,
            revisionHash: `rls-publication-revision-hash-${suffix}`,
            observedAt,
            title: "RLS revision before update",
            publicationType: "news",
          },
        });
        await tx.publication.update({
          where: { id: ids.publicationId },
          data: {
            currentRevisionId: ids.revisionId,
            title: "RLS publication after update",
          },
        });
        await tx.ingestionBatch.create({
          data: {
            id: ids.batchId,
            batchId: `rls-publication-batch-key-${suffix}`,
            runId: ids.runId,
            principalKey: `service:rls-${suffix}`,
            payloadDigest: `rls-publication-digest-${suffix}`,
            itemCount: 1,
          },
        });
        await tx.ingestionBatchObject.create({
          data: {
            id: ids.batchObjectId,
            batchId: ids.batchId,
            objectId: ids.objectId,
            expectedSha256: `rls-publication-sha-${suffix}`,
            expectedSize: 1,
            expectedContentType: "text/html",
          },
        });
        await tx.publicationObjectLink.create({
          data: {
            id: ids.linkId,
            revisionId: ids.revisionId,
            objectId: ids.objectId,
            role: "body_html",
          },
        });
        await tx.publicationEventOutbox.create({
          data: {
            id: ids.eventId,
            eventId: `rls-publication-event-key-${suffix}`,
            eventType: "publication.revision.accepted",
            aggregateType: "publication",
            aggregateId: ids.publicationId,
            payload: { marker: suffix },
          },
        });

        await tx.publicationSource.update({
          where: { id: ids.sourceId },
          data: { name: `[integration-test] RLS publication source updated` },
        });
        await tx.publicationRevision.update({
          where: { id: ids.revisionId },
          data: { title: "RLS revision after update" },
        });
        await tx.publicationObject.update({
          where: { id: ids.objectId },
          data: { lastError: "runtime update marker" },
        });
        await tx.publicationObjectLink.update({
          where: { id: ids.linkId },
          data: { altText: "runtime update marker" },
        });
        await tx.ingestionRun.update({
          where: { id: ids.runId },
          data: { status: "completed" },
        });
        await tx.ingestionBatch.update({
          where: { id: ids.batchId },
          data: { result: { marker: suffix } },
        });
        await tx.ingestionBatchObject.update({
          where: { id: ids.batchObjectId },
          data: { expectedContentType: "text/html; charset=utf-8" },
        });
        await tx.publicationEventOutbox.update({
          where: { id: ids.eventId },
          data: { attempts: 1 },
        });

        const selected = await Promise.all([
          tx.publicationSource.findUnique({
            where: { id: ids.sourceId },
            select: { name: true },
          }),
          tx.publication.findUnique({
            where: { id: ids.publicationId },
            select: { title: true },
          }),
          tx.publicationRevision.findUnique({
            where: { id: ids.revisionId },
            select: { title: true },
          }),
          tx.publicationObject.findUnique({
            where: { id: ids.objectId },
            select: { lastError: true },
          }),
          tx.publicationObjectLink.findUnique({
            where: { id: ids.linkId },
            select: { altText: true },
          }),
          tx.ingestionRun.findUnique({
            where: { id: ids.runId },
            select: { status: true },
          }),
          tx.ingestionBatch.findUnique({
            where: { id: ids.batchId },
            select: { result: true },
          }),
          tx.ingestionBatchObject.findUnique({
            where: { id: ids.batchObjectId },
            select: { expectedContentType: true },
          }),
          tx.publicationEventOutbox.findUnique({
            where: { id: ids.eventId },
            select: { attempts: true },
          }),
        ]);
        expect(selected).toEqual([
          { name: "[integration-test] RLS publication source updated" },
          { title: "RLS publication after update" },
          { title: "RLS revision after update" },
          { lastError: "runtime update marker" },
          { altText: "runtime update marker" },
          { status: "completed" },
          { result: { marker: suffix } },
          { expectedContentType: "text/html; charset=utf-8" },
          { attempts: 1 },
        ]);
      });

      const runtimeDeletes: Array<() => Promise<unknown>> = [
        () => prisma.publicationSource.delete({ where: { id: ids.sourceId } }),
        () => prisma.publication.delete({ where: { id: ids.publicationId } }),
        () =>
          prisma.publicationRevision.delete({ where: { id: ids.revisionId } }),
        () => prisma.publicationObject.delete({ where: { id: ids.objectId } }),
        () =>
          prisma.publicationObjectLink.delete({ where: { id: ids.linkId } }),
        () => prisma.ingestionRun.delete({ where: { id: ids.runId } }),
        () => prisma.ingestionBatch.delete({ where: { id: ids.batchId } }),
        () =>
          prisma.ingestionBatchObject.delete({
            where: { id: ids.batchObjectId },
          }),
        () =>
          prisma.publicationEventOutbox.delete({ where: { id: ids.eventId } }),
      ];
      for (const createOperation of runtimeDeletes) {
        await expect(createOperation()).rejects.toThrow(/permission denied/i);
      }
    } finally {
      await deleteFixture(ids);
    }
  });
});
