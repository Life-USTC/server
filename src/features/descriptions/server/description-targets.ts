import { resolveCourseIdByJwId } from "@/features/catalog/server/course-jw-id";
import type { DescriptionTargetType } from "@/features/descriptions/lib/description-target-types";

export {
  DESCRIPTION_TARGET_TYPES,
  type DescriptionTargetType,
} from "@/features/descriptions/lib/description-target-types";

import { prisma } from "@/lib/db/prisma";
import { parseInteger } from "@/lib/integers";

type DescriptionTargetIdMap = {
  section: number;
  course: number;
  teacher: number;
  homework: string;
};

export type DescriptionTargetWhere = {
  sectionId?: number;
  courseId?: number;
  teacherId?: number;
  homeworkId?: string;
};

type DescriptionTargetConfig<TTargetType extends DescriptionTargetType> = {
  parseId: (
    rawTargetId: string | number,
  ) => DescriptionTargetIdMap[TTargetType] | null;
  findTarget: (
    targetId: DescriptionTargetIdMap[TTargetType],
  ) => Promise<{ id: number | string } | null>;
  where: (
    targetId: DescriptionTargetIdMap[TTargetType],
  ) => DescriptionTargetWhere;
};

function parsePositiveIntegerId(value: string | number) {
  const parsed = parseInteger(value);
  return parsed !== null && parsed > 0 ? parsed : null;
}

function parseHomeworkTargetId(value: string | number) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

const descriptionTargetConfig: {
  [TTargetType in DescriptionTargetType]: DescriptionTargetConfig<TTargetType>;
} = {
  section: {
    parseId: parsePositiveIntegerId,
    findTarget: async (targetId) => {
      return prisma.section.findUnique({
        where: { id: targetId },
        select: { id: true },
      });
    },
    where: (targetId) => ({ sectionId: targetId }),
  },
  course: {
    parseId: parsePositiveIntegerId,
    findTarget: async (targetId) => {
      return prisma.course.findUnique({
        where: { id: targetId },
        select: { id: true },
      });
    },
    where: (targetId) => ({ courseId: targetId }),
  },
  teacher: {
    parseId: parsePositiveIntegerId,
    findTarget: async (targetId) => {
      return prisma.teacher.findUnique({
        where: { id: targetId },
        select: { id: true },
      });
    },
    where: (targetId) => ({ teacherId: targetId }),
  },
  homework: {
    parseId: parseHomeworkTargetId,
    findTarget: async (targetId) => {
      return prisma.homework.findUnique({
        where: { id: targetId },
        select: { id: true },
      });
    },
    where: (targetId) => ({ homeworkId: targetId }),
  },
};

export function resolveDescriptionTarget<
  TTargetType extends DescriptionTargetType,
>(targetType: TTargetType, rawTargetId: string | number) {
  const config = descriptionTargetConfig[targetType];
  const targetId = config.parseId(rawTargetId);
  if (targetId === null) {
    return null;
  }

  return {
    targetId,
    where: config.where(targetId),
    ensureExists: () => config.findTarget(targetId),
  };
}

export type ResolvedDescriptionTarget = NonNullable<
  ReturnType<typeof resolveDescriptionTarget>
>;

export type DescriptionTargetReferenceInput = {
  courseJwId?: unknown;
  homeworkId?: string;
  rawTargetId?: unknown;
  sectionJwId?: unknown;
  targetType: DescriptionTargetType;
  teacherId?: unknown;
  verifyExistence?: boolean;
};

export type ResolvedDescriptionTargetReference =
  | {
      ok: true;
      target: ResolvedDescriptionTarget;
      targetId: number | string;
      targetType: DescriptionTargetType;
    }
  | {
      ok: false;
      error: "invalid_target" | "target_not_found";
      targetId: unknown;
      targetType: DescriptionTargetType | string;
    };

async function findSectionIdByJwId(jwId: number) {
  const section = await prisma.section.findUnique({
    where: { jwId },
    select: { id: true },
  });
  return section?.id ?? null;
}

async function findCourseIdByJwId(jwId: number) {
  return resolveCourseIdByJwId(prisma, jwId);
}

function invalidTarget(
  targetType: DescriptionTargetType,
): ResolvedDescriptionTargetReference {
  return {
    ok: false,
    error: "invalid_target",
    targetId: undefined,
    targetType,
  };
}

function targetNotFound(
  targetType: DescriptionTargetType | string,
  targetId: unknown,
): ResolvedDescriptionTargetReference {
  return {
    ok: false,
    error: "target_not_found",
    targetId,
    targetType,
  };
}

async function resolveVerifiedDescriptionTarget(
  targetType: DescriptionTargetType,
  rawTargetId: unknown,
  verifyExistence: boolean | undefined,
): Promise<ResolvedDescriptionTargetReference> {
  if (typeof rawTargetId !== "string" && typeof rawTargetId !== "number") {
    return invalidTarget(targetType);
  }

  const target = resolveDescriptionTarget(targetType, rawTargetId);
  if (!target) return invalidTarget(targetType);

  if (verifyExistence) {
    const existingTarget = await target.ensureExists();
    if (!existingTarget) return targetNotFound(targetType, target.targetId);
  }

  return {
    ok: true,
    target,
    targetId: target.targetId,
    targetType,
  };
}

export async function resolveDescriptionTargetReference(
  input: DescriptionTargetReferenceInput,
): Promise<ResolvedDescriptionTargetReference> {
  const sectionJwId = parseInteger(input.sectionJwId);
  const courseJwId = parseInteger(input.courseJwId);

  if (input.targetType === "section" && sectionJwId) {
    const sectionId = await findSectionIdByJwId(sectionJwId);
    if (!sectionId) return targetNotFound("section", sectionJwId);
    return resolveVerifiedDescriptionTarget(
      "section",
      sectionId,
      input.verifyExistence,
    );
  }

  if (input.targetType === "course" && courseJwId) {
    const courseId = await findCourseIdByJwId(courseJwId);
    if (!courseId) return targetNotFound("course", courseJwId);
    return resolveVerifiedDescriptionTarget(
      "course",
      courseId,
      input.verifyExistence,
    );
  }

  if (input.targetType === "teacher") {
    return resolveVerifiedDescriptionTarget(
      "teacher",
      input.teacherId ?? input.rawTargetId,
      input.verifyExistence,
    );
  }

  if (input.targetType === "homework") {
    return resolveVerifiedDescriptionTarget(
      "homework",
      input.homeworkId ?? input.rawTargetId,
      input.verifyExistence,
    );
  }

  return resolveVerifiedDescriptionTarget(
    input.targetType,
    input.rawTargetId,
    input.verifyExistence,
  );
}
