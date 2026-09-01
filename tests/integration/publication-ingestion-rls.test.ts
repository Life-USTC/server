import { afterAll, describe, expect, it } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { createTestPrisma, disconnectTestPrisma } from "../shared/prisma";

const databaseUrl =
  process.env.FUNCTION_OWNER_DATABASE_URL ?? process.env.DATABASE_URL;
const adminPrisma = databaseUrl ? createTestPrisma(databaseUrl) : null;

const publicationIngestionTables = [
  "IngestionBatch",
  "IngestionBatchObject",
  "IngestionRun",
  "Publication",
  "PublicationEventOutbox",
  "PublicationObject",
  "PublicationObjectLink",
  "PublicationRevision",
  "PublicationSource",
] as const;

describe.skipIf(
  process.env.RLS_TEST_ENABLED !== "true" || adminPrisma === null,
)("publication ingestion PostgreSQL row security", () => {
  afterAll(async () => {
    await Promise.all([
      prisma.$disconnect(),
      adminPrisma ? disconnectTestPrisma(adminPrisma) : undefined,
    ]);
  });

  it("keeps ingestion tables behind the app runtime policy and write grant", async () => {
    if (!adminPrisma) throw new Error("DATABASE_URL is required");
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
});
