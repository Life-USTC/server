import { Prisma } from "../generated/prisma-node/client";
import {
  type CourseDuplicateMerge,
  planCourseDuplicateMerges,
} from "./course-dedupe";
import type { IncomingCourseIdentityRecord } from "./course-identity";

type CourseJwIdClient = Pick<
  Prisma.TransactionClient,
  "course" | "courseAlias"
>;

type CourseDescriptionClient = Pick<
  Prisma.TransactionClient,
  "description" | "descriptionEdit"
>;

export type CourseMergeStats = {
  mergedCourses: number;
};

const EMPTY_COURSE_MERGE_STATS: CourseMergeStats = {
  mergedCourses: 0,
};

const persistedCourseIdentitySelect = {
  id: true,
  jwId: true,
  code: true,
  nameCn: true,
  nameEn: true,
  categoryId: true,
  classTypeId: true,
  classifyId: true,
  educationLevelId: true,
  gradationId: true,
  typeId: true,
} as const;

export async function assertCourseJwIdNamespace(
  tx: CourseJwIdClient,
  plannedCourseJwIds: readonly number[] = [],
) {
  const [courses, aliases] = await Promise.all([
    tx.course.findMany({ select: { jwId: true } }),
    tx.courseAlias.findMany({ select: { jwId: true } }),
  ]);
  const courseJwIds = new Set([
    ...courses.map((course) => course.jwId),
    ...plannedCourseJwIds,
  ]);
  const collision = aliases
    .map((alias) => alias.jwId)
    .sort((left, right) => left - right)
    .find((jwId) => courseJwIds.has(jwId));
  if (collision != null) {
    throw new Error(
      `Course jwId namespace collision: ${collision} is both a Course and CourseAlias`,
    );
  }
}

export async function assertCourseAliasJwIdAvailable(
  tx: CourseJwIdClient,
  jwId: number,
) {
  const course = await tx.course.findUnique({
    where: { jwId },
    select: { id: true },
  });
  if (course != null) {
    throw new Error(
      `Course jwId namespace collision: ${jwId} is already used by a Course`,
    );
  }
}

export async function mergeCourseDescriptions(
  tx: CourseDescriptionClient,
  sourceCourseId: number,
  targetCourseId: number,
) {
  const descriptions = await tx.description.findMany({
    where: { courseId: { in: [sourceCourseId, targetCourseId] } },
    select: {
      id: true,
      courseId: true,
      content: true,
      createdAt: true,
      updatedAt: true,
      lastEditedAt: true,
      lastEditedById: true,
    },
  });
  const source = descriptions.find(
    (description) => description.courseId === sourceCourseId,
  );
  if (!source) return;

  const target = descriptions.find(
    (description) => description.courseId === targetCourseId,
  );
  if (!target) {
    await tx.description.update({
      where: { id: source.id },
      data: {
        courseId: targetCourseId,
        updatedAt: source.updatedAt,
      },
    });
    return;
  }

  if (source.content !== target.content) {
    throw new Error(
      `Cannot merge Courses ${sourceCourseId} and ${targetCourseId}: descriptions differ`,
    );
  }

  const sourceHasNewerEdit =
    source.lastEditedAt != null &&
    (target.lastEditedAt == null ||
      source.lastEditedAt.getTime() > target.lastEditedAt.getTime());
  await tx.descriptionEdit.updateMany({
    where: { descriptionId: source.id },
    data: { descriptionId: target.id },
  });
  await tx.description.update({
    where: { id: target.id },
    data: {
      createdAt:
        source.createdAt.getTime() < target.createdAt.getTime()
          ? source.createdAt
          : target.createdAt,
      updatedAt:
        source.updatedAt.getTime() > target.updatedAt.getTime()
          ? source.updatedAt
          : target.updatedAt,
      ...(sourceHasNewerEdit
        ? {
            lastEditedAt: source.lastEditedAt,
            lastEditedById: source.lastEditedById,
          }
        : {}),
    },
  });
  await tx.description.delete({ where: { id: source.id } });
}

async function mergePlannedCourseDescriptions(
  tx: CourseDescriptionClient,
  merges: CourseDuplicateMerge[],
) {
  const describedSources = await tx.description.findMany({
    where: {
      courseId: { in: merges.map((merge) => merge.sourceCourseId) },
    },
    select: { courseId: true },
  });
  const describedSourceIds = new Set(
    describedSources.map((description) => description.courseId),
  );

  for (const merge of merges) {
    if (!describedSourceIds.has(merge.sourceCourseId)) continue;
    await mergeCourseDescriptions(
      tx,
      merge.sourceCourseId,
      merge.targetCourseId,
    );
  }
}

async function lockCourseMergeRows(
  tx: Prisma.TransactionClient,
  courseIds: number[],
) {
  const ids = [...new Set(courseIds)].sort((left, right) => left - right);
  if (ids.length === 0) return;
  await tx.$queryRaw(
    Prisma.sql`
      SELECT "id"
      FROM "Course"
      WHERE "id" IN (${Prisma.join(ids)})
      ORDER BY "id"
      FOR UPDATE
    `,
  );
}

async function lockCourseDescriptionRows(
  tx: Prisma.TransactionClient,
  courseIds: number[],
) {
  const ids = [...new Set(courseIds)].sort((left, right) => left - right);
  if (ids.length === 0) return;
  await tx.$queryRaw(
    Prisma.sql`
      SELECT "id"
      FROM "Description"
      WHERE "courseId" IN (${Prisma.join(ids)})
      ORDER BY "id"
      FOR UPDATE
    `,
  );
}

async function lockCourseAliasRows(
  tx: Prisma.TransactionClient,
  jwIds: number[],
) {
  const ids = [...new Set(jwIds)].sort((left, right) => left - right);
  if (ids.length === 0) return;
  await tx.$queryRaw(
    Prisma.sql`
      SELECT "jwId"
      FROM "CourseAlias"
      WHERE "jwId" IN (${Prisma.join(ids)})
      ORDER BY "jwId"
      FOR UPDATE
    `,
  );
}

async function assertCourseAliasMappingsAvailable(
  tx: Prisma.TransactionClient,
  merges: CourseDuplicateMerge[],
) {
  const aliases = await tx.courseAlias.findMany({
    where: { jwId: { in: merges.map((merge) => merge.sourceJwId) } },
    select: { jwId: true, courseId: true },
  });
  const mergeBySourceJwId = new Map(
    merges.map((merge) => [merge.sourceJwId, merge] as const),
  );
  const collision = aliases.find((alias) => {
    const merge = mergeBySourceJwId.get(alias.jwId);
    return (
      merge == null ||
      (alias.courseId !== merge.sourceCourseId &&
        alias.courseId !== merge.targetCourseId)
    );
  });
  if (collision != null) {
    throw new Error(
      `Course alias ${collision.jwId} already points to another Course`,
    );
  }
}

async function createCourseMergeMap(
  tx: Prisma.TransactionClient,
  merges: CourseDuplicateMerge[],
) {
  await tx.$executeRawUnsafe(`
    CREATE TEMP TABLE IF NOT EXISTS "_StaticCourseMergeMap" (
      "sourceCourseId" INTEGER PRIMARY KEY,
      "sourceJwId" INTEGER NOT NULL UNIQUE,
      "targetCourseId" INTEGER NOT NULL
    ) ON COMMIT DROP
  `);
  await tx.$executeRawUnsafe('TRUNCATE TABLE "_StaticCourseMergeMap"');

  for (let offset = 0; offset < merges.length; offset += 1000) {
    const values = merges
      .slice(offset, offset + 1000)
      .map(
        (merge) =>
          Prisma.sql`(${merge.sourceCourseId}, ${merge.sourceJwId}, ${merge.targetCourseId})`,
      );
    await tx.$executeRaw(
      Prisma.sql`
        INSERT INTO "_StaticCourseMergeMap" (
          "sourceCourseId",
          "sourceJwId",
          "targetCourseId"
        )
        VALUES ${Prisma.join(values)}
      `,
    );
  }
}

async function migrateCourseRelations(tx: Prisma.TransactionClient) {
  await tx.$executeRawUnsafe(`
    UPDATE "Section" AS section
    SET "courseId" = mapping."targetCourseId"
    FROM "_StaticCourseMergeMap" AS mapping
    WHERE section."courseId" = mapping."sourceCourseId"
  `);
  await tx.$executeRawUnsafe(`
    UPDATE "Comment" AS comment
    SET "courseId" = mapping."targetCourseId"
    FROM "_StaticCourseMergeMap" AS mapping
    WHERE comment."courseId" = mapping."sourceCourseId"
  `);
  await tx.$executeRawUnsafe(`
    UPDATE "CourseAlias" AS alias
    SET "courseId" = mapping."targetCourseId"
    FROM "_StaticCourseMergeMap" AS mapping
    WHERE alias."courseId" = mapping."sourceCourseId"
  `);
  const deletedCourses = await tx.$executeRawUnsafe(`
    DELETE FROM "Course" AS course
    USING "_StaticCourseMergeMap" AS mapping
    WHERE course."id" = mapping."sourceCourseId"
  `);
  await tx.$executeRawUnsafe(`
    INSERT INTO "CourseAlias" ("jwId", "courseId")
    SELECT mapping."sourceJwId", mapping."targetCourseId"
    FROM "_StaticCourseMergeMap" AS mapping
    ON CONFLICT ("jwId") DO UPDATE
    SET "courseId" = EXCLUDED."courseId"
  `);
  return deletedCourses;
}

export async function mergeLegacyCourseDuplicates(
  tx: Prisma.TransactionClient,
  incomingCourses: IncomingCourseIdentityRecord[],
  canonicalJwIds: ReadonlySet<number>,
): Promise<CourseMergeStats> {
  const incomingSourceJwIds = new Set(
    incomingCourses.map((course) => course.jwId),
  );
  const initialMerges = planCourseDuplicateMerges({
    canonicalJwIds,
    incomingSourceJwIds,
    persistedCourses: await tx.course.findMany({
      select: persistedCourseIdentitySelect,
    }),
  });
  await lockCourseMergeRows(
    tx,
    initialMerges.flatMap((merge) => [
      merge.sourceCourseId,
      merge.targetCourseId,
    ]),
  );

  const lockedCourseIds = new Set(
    initialMerges.flatMap((merge) => [
      merge.sourceCourseId,
      merge.targetCourseId,
    ]),
  );
  const merges = planCourseDuplicateMerges({
    canonicalJwIds,
    incomingSourceJwIds,
    persistedCourses: await tx.course.findMany({
      select: persistedCourseIdentitySelect,
    }),
  });
  const unlockedMerge = merges.find(
    (merge) =>
      !lockedCourseIds.has(merge.sourceCourseId) ||
      !lockedCourseIds.has(merge.targetCourseId),
  );
  if (unlockedMerge) {
    throw new Error(
      `Course cleanup changed while acquiring locks; retry the import for legacy Course ${unlockedMerge.sourceJwId}`,
    );
  }
  if (merges.length === 0) return { ...EMPTY_COURSE_MERGE_STATS };

  await lockCourseDescriptionRows(
    tx,
    merges.flatMap((merge) => [merge.sourceCourseId, merge.targetCourseId]),
  );

  await lockCourseAliasRows(
    tx,
    merges.map((merge) => merge.sourceJwId),
  );
  await assertCourseAliasMappingsAvailable(tx, merges);
  await mergePlannedCourseDescriptions(tx, merges);

  await createCourseMergeMap(tx, merges);
  const deletedCourses = await migrateCourseRelations(tx);
  if (deletedCourses !== merges.length) {
    throw new Error(
      `Course cleanup deleted ${deletedCourses} of ${merges.length} planned legacy Courses`,
    );
  }
  await assertCourseJwIdNamespace(tx);

  console.log(`Merged ${merges.length} legacy Course rows`);
  return { mergedCourses: merges.length };
}
