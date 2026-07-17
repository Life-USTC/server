import type { Prisma } from "../generated/prisma-node/client";
import type {
  CatalogFallbackResolution,
  TeacherIdentityReference,
} from "./teacher-identity";

type ReconciliationMapping = {
  fallbackId: number;
  targetId: number;
  label: string;
};

export type TeacherFallbackReconciliationStats = {
  matchedFallbacks: number;
  transferredDescriptions: number;
  deletedFallbacks: number;
  retainedFallbacks: number;
  skippedResolutions: number;
};

type ReconciliationOptions = {
  resolveDepartmentId: (
    departmentCode: string | undefined,
  ) => number | undefined;
  resolveTargetId: (identity: TeacherIdentityReference) => number | undefined;
  warn?: (message: string) => void;
};

const EMPTY_STATS: TeacherFallbackReconciliationStats = {
  matchedFallbacks: 0,
  transferredDescriptions: 0,
  deletedFallbacks: 0,
  retainedFallbacks: 0,
  skippedResolutions: 0,
};

export async function reconcileCatalogTeacherFallbacks(
  tx: Prisma.TransactionClient,
  resolutions: CatalogFallbackResolution[],
  options: ReconciliationOptions,
): Promise<TeacherFallbackReconciliationStats> {
  if (resolutions.length === 0) return { ...EMPTY_STATS };

  const warn = options.warn ?? console.warn;
  const fallbackTeachers = await tx.teacher.findMany({
    where: {
      personId: null,
      teacherId: null,
      OR: [{ code: null }, { code: "" }],
    },
    select: {
      id: true,
      nameCn: true,
      departmentId: true,
    },
  });
  const fallbackTeachersByKey = new Map<
    string,
    Array<(typeof fallbackTeachers)[number]>
  >();
  for (const teacher of fallbackTeachers) {
    const key = databaseFallbackKey(teacher.nameCn, teacher.departmentId);
    const matches = fallbackTeachersByKey.get(key) ?? [];
    matches.push(teacher);
    fallbackTeachersByKey.set(key, matches);
  }

  const mappings: ReconciliationMapping[] = [];
  let skippedResolutions = 0;
  for (const resolution of resolutions) {
    const label = JSON.stringify([
      resolution.fallback.nameCn,
      resolution.fallback.departmentCode ?? null,
    ]);
    const departmentId = options.resolveDepartmentId(
      resolution.fallback.departmentCode,
    );
    if (departmentId == null) {
      warn(`Teacher fallback ${label} retained: department did not resolve`);
      skippedResolutions += 1;
      continue;
    }

    const fallbackMatches =
      fallbackTeachersByKey.get(
        databaseFallbackKey(resolution.fallback.nameCn, departmentId),
      ) ?? [];
    if (fallbackMatches.length === 0) continue;
    if (fallbackMatches.length !== 1) {
      warn(
        `Teacher fallback ${label} retained: found ${fallbackMatches.length} database rows`,
      );
      skippedResolutions += 1;
      continue;
    }
    if (resolution.targetIdentity == null) {
      warn(
        `Teacher fallback ${label} retained: stable identity is globally ambiguous`,
      );
      skippedResolutions += 1;
      continue;
    }

    const targetId = options.resolveTargetId(resolution.targetIdentity);
    if (targetId == null || targetId === fallbackMatches[0].id) {
      warn(`Teacher fallback ${label} retained: target did not resolve`);
      skippedResolutions += 1;
      continue;
    }
    mappings.push({
      fallbackId: fallbackMatches[0].id,
      targetId,
      label,
    });
  }

  if (mappings.length === 0) {
    return { ...EMPTY_STATS, skippedResolutions };
  }

  const involvedTeacherIds = [
    ...new Set(
      mappings.flatMap(({ fallbackId, targetId }) => [fallbackId, targetId]),
    ),
  ];
  await lockTeachers(tx, involvedTeacherIds);
  const descriptions = await tx.description.findMany({
    where: { teacherId: { in: involvedTeacherIds } },
    select: { id: true, teacherId: true },
  });
  const descriptionByTeacherId = new Map(
    descriptions
      .filter(
        (
          description,
        ): description is typeof description & { teacherId: number } =>
          description.teacherId != null,
      )
      .map((description) => [description.teacherId, description] as const),
  );
  const describedFallbacksByTarget = new Map<number, ReconciliationMapping[]>();
  for (const mapping of mappings) {
    if (!descriptionByTeacherId.has(mapping.fallbackId)) continue;
    const group = describedFallbacksByTarget.get(mapping.targetId) ?? [];
    group.push(mapping);
    describedFallbacksByTarget.set(mapping.targetId, group);
  }

  let transferredDescriptions = 0;
  for (const [targetId, describedMappings] of describedFallbacksByTarget) {
    const targetDescription = descriptionByTeacherId.get(targetId);
    if (targetDescription != null || describedMappings.length !== 1) {
      for (const mapping of describedMappings) {
        warn(
          `Teacher fallback ${mapping.label} retained: Description content cannot be transferred without a conflict`,
        );
      }
      continue;
    }

    const mapping = describedMappings[0];
    const fallbackDescription = descriptionByTeacherId.get(mapping.fallbackId);
    if (fallbackDescription == null) continue;
    await tx.description.update({
      where: { id: fallbackDescription.id },
      data: { teacherId: targetId },
    });
    transferredDescriptions += 1;
  }

  await createReconciliationMap(tx, mappings);
  await migrateTeacherRelations(tx);

  const remainingFallbacks = await tx.teacher.findMany({
    where: { id: { in: mappings.map(({ fallbackId }) => fallbackId) } },
    select: {
      id: true,
      description: { select: { id: true } },
      _count: {
        select: {
          comments: true,
          sections: true,
          schedules: true,
          sectionTeachers: true,
          teacherAssignments: true,
        },
      },
    },
  });
  const deletableIds: number[] = [];
  for (const fallback of remainingFallbacks) {
    const hasRelations =
      fallback.description != null ||
      Object.values(fallback._count).some((count) => count > 0);
    if (hasRelations) {
      const mapping = mappings.find(
        ({ fallbackId }) => fallbackId === fallback.id,
      );
      warn(
        `Teacher fallback ${mapping?.label ?? fallback.id} retained: content or relationships remain`,
      );
    } else {
      deletableIds.push(fallback.id);
    }
  }
  if (deletableIds.length > 0) {
    await tx.teacher.deleteMany({ where: { id: { in: deletableIds } } });
  }

  return {
    matchedFallbacks: mappings.length,
    transferredDescriptions,
    deletedFallbacks: deletableIds.length,
    retainedFallbacks: remainingFallbacks.length - deletableIds.length,
    skippedResolutions,
  };
}

function databaseFallbackKey(
  nameCn: string,
  departmentId: number | null,
): string {
  return JSON.stringify([nameCn, departmentId]);
}

async function lockTeachers(
  tx: Prisma.TransactionClient,
  teacherIds: number[],
): Promise<void> {
  const ids = teacherIds.join(",");
  await tx.$queryRawUnsafe(
    `SELECT "id" FROM "Teacher" WHERE "id" IN (${ids}) ORDER BY "id" FOR UPDATE`,
  );
}

async function createReconciliationMap(
  tx: Prisma.TransactionClient,
  mappings: ReconciliationMapping[],
): Promise<void> {
  await tx.$executeRawUnsafe(`
    CREATE TEMP TABLE IF NOT EXISTS "_StaticTeacherFallbackMap" (
      "fallbackId" INTEGER PRIMARY KEY,
      "targetId" INTEGER NOT NULL
    ) ON COMMIT DROP
  `);
  await tx.$executeRawUnsafe('TRUNCATE TABLE "_StaticTeacherFallbackMap"');
  for (let offset = 0; offset < mappings.length; offset += 1000) {
    const values = mappings
      .slice(offset, offset + 1000)
      .map(({ fallbackId, targetId }) => `(${fallbackId},${targetId})`)
      .join(",");
    await tx.$executeRawUnsafe(
      `INSERT INTO "_StaticTeacherFallbackMap" ("fallbackId","targetId") VALUES ${values}`,
    );
  }
}

async function migrateTeacherRelations(
  tx: Prisma.TransactionClient,
): Promise<void> {
  await lockMappedSectionTeachers(tx);

  await tx.$executeRawUnsafe(`
    UPDATE "Comment" AS comment
    SET "teacherId" = mapping."targetId"
    FROM "_StaticTeacherFallbackMap" AS mapping
    WHERE comment."teacherId" = mapping."fallbackId"
  `);

  await tx.$executeRawUnsafe(`
    INSERT INTO "_SectionTeachers" ("A","B")
    SELECT relation."A", mapping."targetId"
    FROM "_SectionTeachers" AS relation
    JOIN "_StaticTeacherFallbackMap" AS mapping
      ON mapping."fallbackId" = relation."B"
    ON CONFLICT DO NOTHING
  `);
  await tx.$executeRawUnsafe(`
    DELETE FROM "_SectionTeachers" AS relation
    USING "_StaticTeacherFallbackMap" AS mapping
    WHERE relation."B" = mapping."fallbackId"
  `);

  await tx.$executeRawUnsafe(`
    INSERT INTO "_ScheduleTeachers" ("A","B")
    SELECT relation."A", mapping."targetId"
    FROM "_ScheduleTeachers" AS relation
    JOIN "_StaticTeacherFallbackMap" AS mapping
      ON mapping."fallbackId" = relation."B"
    ON CONFLICT DO NOTHING
  `);
  await tx.$executeRawUnsafe(`
    DELETE FROM "_ScheduleTeachers" AS relation
    USING "_StaticTeacherFallbackMap" AS mapping
    WHERE relation."B" = mapping."fallbackId"
  `);

  await tx.$executeRawUnsafe(`
    INSERT INTO "TeacherAssignment" (
      "teacherId",
      "sectionId",
      "role",
      "period",
      "weekIndices",
      "weekIndicesMsg",
      "teacherLessonTypeId"
    )
    SELECT DISTINCT ON (mapping."targetId", assignment."sectionId")
      mapping."targetId",
      assignment."sectionId",
      assignment."role",
      assignment."period",
      assignment."weekIndices",
      assignment."weekIndicesMsg",
      assignment."teacherLessonTypeId"
    FROM "TeacherAssignment" AS assignment
    JOIN "_StaticTeacherFallbackMap" AS mapping
      ON mapping."fallbackId" = assignment."teacherId"
    ORDER BY mapping."targetId", assignment."sectionId", assignment."id"
    ON CONFLICT ("teacherId","sectionId") DO NOTHING
  `);
  await tx.$executeRawUnsafe(`
    DELETE FROM "TeacherAssignment" AS assignment
    USING "_StaticTeacherFallbackMap" AS mapping
    WHERE assignment."teacherId" = mapping."fallbackId"
  `);

  await tx.$executeRawUnsafe(`
    UPDATE "SectionTeacher" AS target
    SET
      "retiredAt" = NULL,
      "updatedAt" = CURRENT_TIMESTAMP
    WHERE target."retiredAt" IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM "SectionTeacher" AS source
        JOIN "_StaticTeacherFallbackMap" AS mapping
          ON mapping."fallbackId" = source."teacherId"
        WHERE source."sectionId" = target."sectionId"
          AND mapping."targetId" = target."teacherId"
          AND source."retiredAt" IS NULL
      )
  `);

  await tx.$executeRawUnsafe(`
    UPDATE "Comment" AS comment
    SET "sectionTeacherId" = target."id"
    FROM "SectionTeacher" AS source
    JOIN "_StaticTeacherFallbackMap" AS mapping
      ON mapping."fallbackId" = source."teacherId"
    JOIN "SectionTeacher" AS target
      ON target."sectionId" = source."sectionId"
      AND target."teacherId" = mapping."targetId"
    WHERE comment."sectionTeacherId" = source."id"
  `);
  await tx.$executeRawUnsafe(`
    DELETE FROM "SectionTeacher" AS source
    USING "_StaticTeacherFallbackMap" AS mapping
    WHERE source."teacherId" = mapping."fallbackId"
      AND EXISTS (
        SELECT 1
        FROM "SectionTeacher" AS target
        WHERE target."sectionId" = source."sectionId"
          AND target."teacherId" = mapping."targetId"
      )
  `);

  await tx.$executeRawUnsafe(`
    WITH ranked AS (
      SELECT
        source."id",
        FIRST_VALUE(source."id") OVER (
          PARTITION BY source."sectionId", mapping."targetId"
          ORDER BY (source."retiredAt" IS NOT NULL), source."id"
        ) AS "keeperId"
      FROM "SectionTeacher" AS source
      JOIN "_StaticTeacherFallbackMap" AS mapping
        ON mapping."fallbackId" = source."teacherId"
    )
    UPDATE "Comment" AS comment
    SET "sectionTeacherId" = ranked."keeperId"
    FROM ranked
    WHERE comment."sectionTeacherId" = ranked."id"
      AND ranked."id" <> ranked."keeperId"
  `);
  await tx.$executeRawUnsafe(`
    WITH ranked AS (
      SELECT
        source."id",
        FIRST_VALUE(source."id") OVER (
          PARTITION BY source."sectionId", mapping."targetId"
          ORDER BY (source."retiredAt" IS NOT NULL), source."id"
        ) AS "keeperId"
      FROM "SectionTeacher" AS source
      JOIN "_StaticTeacherFallbackMap" AS mapping
        ON mapping."fallbackId" = source."teacherId"
    )
    DELETE FROM "SectionTeacher" AS source
    USING ranked
    WHERE source."id" = ranked."id"
      AND ranked."id" <> ranked."keeperId"
  `);
  await tx.$executeRawUnsafe(`
    UPDATE "SectionTeacher" AS source
    SET
      "teacherId" = mapping."targetId",
      "updatedAt" = CURRENT_TIMESTAMP
    FROM "_StaticTeacherFallbackMap" AS mapping
    WHERE source."teacherId" = mapping."fallbackId"
  `);
}

async function lockMappedSectionTeachers(
  tx: Prisma.TransactionClient,
): Promise<void> {
  await tx.$queryRawUnsafe(`
    SELECT section_teacher."id"
    FROM "SectionTeacher" AS section_teacher
    WHERE EXISTS (
      SELECT 1
      FROM "SectionTeacher" AS source
      JOIN "_StaticTeacherFallbackMap" AS mapping
        ON mapping."fallbackId" = source."teacherId"
      WHERE source."sectionId" = section_teacher."sectionId"
        AND section_teacher."teacherId" IN (
          mapping."fallbackId",
          mapping."targetId"
        )
    )
    ORDER BY section_teacher."id"
    FOR UPDATE OF section_teacher
  `);
}
