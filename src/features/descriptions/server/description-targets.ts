import { parseInteger } from "@/lib/api/helpers";

export type DescriptionTargetType =
  | "section"
  | "course"
  | "teacher"
  | "homework";

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
      const { prisma } = await import("@/lib/db/prisma");
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
      const { prisma } = await import("@/lib/db/prisma");
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
      const { prisma } = await import("@/lib/db/prisma");
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
      const { prisma } = await import("@/lib/db/prisma");
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
