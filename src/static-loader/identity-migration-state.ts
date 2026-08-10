import type { Prisma } from "../generated/prisma-node/client";

export const RAW_JWID_MIGRATION_ID = "raw-jwid-v1";

export const LEGACY_STATIC_IDENTITY_INDEXES = [
  "Campus_nameCn_key",
  "AdminClass_nameCn_key",
  "ExamBatch_nameCn_key",
  "TeacherTitle_nameCn_key",
  "Room_buildingId_code_key",
  "Teacher_personId_key",
  "Teacher_teacherId_key",
  "Teacher_code_key",
] as const;

type StaticIdentityMigrationTransaction = {
  staticIdentityMigrationState: Pick<
    Prisma.TransactionClient["staticIdentityMigrationState"],
    "create" | "findUnique"
  >;
  $executeRawUnsafe(query: string): Promise<number>;
  $queryRawUnsafe<T>(query: string): Promise<T>;
};

type StaticIdentityMigrationInput = {
  bootstrapEnabled: boolean;
  snapshotSha256: string;
};

export async function ensureStaticIdentityMigrationComplete(
  tx: StaticIdentityMigrationTransaction,
  input: StaticIdentityMigrationInput,
): Promise<void> {
  const migrationState = await tx.staticIdentityMigrationState.findUnique({
    where: { id: RAW_JWID_MIGRATION_ID },
    select: { id: true },
  });

  if (migrationState == null) {
    const [{ present = false } = {}] = await tx.$queryRawUnsafe<
      Array<{ present: boolean }>
    >(`SELECT EXISTS (
      SELECT 1 FROM "Course"
      UNION ALL SELECT 1 FROM "AdminClass"
      UNION ALL SELECT 1 FROM "TeacherTitle"
      UNION ALL SELECT 1 FROM "ExamBatch"
      UNION ALL SELECT 1 FROM "Department"
      UNION ALL SELECT 1 FROM "Campus"
      UNION ALL SELECT 1 FROM "Teacher"
      UNION ALL SELECT 1 FROM "Section"
    ) AS "present"`);
    if (!input.bootstrapEnabled || present) {
      throw new Error(
        "Static identity data migration raw-jwid-v1 has not completed",
      );
    }

    for (const index of LEGACY_STATIC_IDENTITY_INDEXES) {
      await tx.$executeRawUnsafe(`DROP INDEX IF EXISTS "${index}"`);
    }
    await tx.staticIdentityMigrationState.create({
      data: {
        id: RAW_JWID_MIGRATION_ID,
        snapshotSha256: input.snapshotSha256,
        completedAt: new Date(),
      },
    });
    return;
  }

  const legacyIndexes = await tx.$queryRawUnsafe<Array<{ indexname: string }>>(
    `SELECT indexname
     FROM pg_indexes
     WHERE schemaname = current_schema()
       AND indexname IN (${LEGACY_STATIC_IDENTITY_INDEXES.map((index) => `'${index}'`).join(", ")})
     ORDER BY indexname`,
  );
  if (legacyIndexes.length > 0) {
    throw new Error(
      `Static identity data migration is incomplete; legacy unique indexes remain: ${legacyIndexes.map(({ indexname }) => indexname).join(", ")}`,
    );
  }
}
