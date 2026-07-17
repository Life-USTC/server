import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  expectedRecoveryGuard,
  type RecoveryDatabaseClient,
  verifyRestoredDatabase,
} from "../../scripts/verify-restored-database";
import {
  createTestPrisma,
  disconnectTestPrisma,
  type TestPrismaClient,
} from "../shared/prisma";

const GUARD = "integration-recovery-guard-20260718";

function quoteIdentifier(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

function quoteLiteral(value: string) {
  return `'${value.replaceAll("'", "''")}'`;
}

describe("restored database verifier integration", () => {
  let prisma: TestPrismaClient;

  beforeAll(() => {
    prisma = createTestPrisma();
  });

  afterAll(async () => {
    await disconnectTestPrisma(prisma);
  });

  it("reads only aggregate integrity data after validating the database guard", async () => {
    const rows = await prisma.$queryRawUnsafe<
      Array<{ databaseName: string; previousComment: string | null }>
    >(`
      SELECT
        current_database() AS "databaseName",
        shobj_description(database.oid, 'pg_database') AS "previousComment"
      FROM pg_database AS database
      WHERE database.datname = current_database()
    `);
    const databaseName = rows[0]?.databaseName;
    if (!databaseName) throw new Error("Test database name was not available");

    await prisma.$executeRawUnsafe(
      `COMMENT ON DATABASE ${quoteIdentifier(databaseName)} IS ${quoteLiteral(expectedRecoveryGuard(GUARD))}`,
    );

    try {
      const report = await verifyRestoredDatabase(
        prisma as unknown as RecoveryDatabaseClient,
        GUARD,
        () => new Date("2026-07-18T00:00:00.000Z"),
      );

      expect(report.guardVerified).toBe(true);
      expect(report.ok).toBe(true);
      expect(report.counts.sections).toBeGreaterThan(0);
      expect(Object.values(report.violations)).toEqual(
        expect.arrayContaining([0]),
      );
      expect(new Set(Object.values(report.violations))).toEqual(new Set([0]));
    } finally {
      const previousComment = rows[0]?.previousComment;
      const restore = previousComment ? quoteLiteral(previousComment) : "NULL";
      await prisma.$executeRawUnsafe(
        `COMMENT ON DATABASE ${quoteIdentifier(databaseName)} IS ${restore}`,
      );
    }
  });
});
