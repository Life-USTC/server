import { Prisma } from "../generated/prisma-node/client";
import { planCourseDuplicateMerges } from "./course-dedupe";
import type { IncomingCourseIdentityRecord } from "./course-identity";

type CourseJwIdClient = Pick<
  Prisma.TransactionClient,
  "course" | "courseAlias"
>;

type CourseDescriptionClient = Pick<
  Prisma.TransactionClient,
  "description" | "descriptionEdit"
>;

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

export async function mergeLegacyCourseDuplicates(
  tx: Prisma.TransactionClient,
  incomingCourses: IncomingCourseIdentityRecord[],
  canonicalJwIds: ReadonlySet<number>,
) {
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
  await lockCourseDescriptionRows(
    tx,
    merges.flatMap((merge) => [merge.sourceCourseId, merge.targetCourseId]),
  );

  for (const merge of merges) {
    await mergeCourseDescriptions(
      tx,
      merge.sourceCourseId,
      merge.targetCourseId,
    );
    await tx.section.updateMany({
      where: { courseId: merge.sourceCourseId },
      data: { courseId: merge.targetCourseId },
    });
    await tx.$executeRaw`
      UPDATE "Comment"
      SET "courseId" = ${merge.targetCourseId}
      WHERE "courseId" = ${merge.sourceCourseId}
    `;

    const existingAlias = await tx.courseAlias.findUnique({
      where: { jwId: merge.sourceJwId },
      select: { courseId: true },
    });
    if (
      existingAlias != null &&
      existingAlias.courseId !== merge.sourceCourseId &&
      existingAlias.courseId !== merge.targetCourseId
    ) {
      throw new Error(
        `Course alias ${merge.sourceJwId} already points to another Course`,
      );
    }
    await tx.courseAlias.updateMany({
      where: { courseId: merge.sourceCourseId },
      data: { courseId: merge.targetCourseId },
    });
    await tx.course.delete({ where: { id: merge.sourceCourseId } });
    await assertCourseAliasJwIdAvailable(tx, merge.sourceJwId);
    await tx.courseAlias.upsert({
      where: { jwId: merge.sourceJwId },
      create: {
        jwId: merge.sourceJwId,
        courseId: merge.targetCourseId,
      },
      update: { courseId: merge.targetCourseId },
    });
  }

  if (merges.length > 0) {
    console.log(`Merged ${merges.length} legacy Course rows`);
  }
}
