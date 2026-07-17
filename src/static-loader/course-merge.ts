import type { Prisma } from "../generated/prisma-node/client";
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
      data: { courseId: targetCourseId },
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

export async function mergeLegacyCourseDuplicates(
  tx: Prisma.TransactionClient,
  incomingCourses: IncomingCourseIdentityRecord[],
  canonicalJwIds: ReadonlySet<number>,
) {
  const persistedCourses = await tx.course.findMany({
    select: {
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
    },
  });
  const merges = planCourseDuplicateMerges({
    canonicalJwIds,
    incomingSourceJwIds: new Set(incomingCourses.map((course) => course.jwId)),
    persistedCourses,
  });

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
    await tx.comment.updateMany({
      where: { courseId: merge.sourceCourseId },
      data: { courseId: merge.targetCourseId },
    });

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
