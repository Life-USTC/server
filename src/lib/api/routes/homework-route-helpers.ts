import type { Prisma } from "@/generated/prisma/client";
import { badRequest, parseInteger, parseRouteInput } from "@/lib/api/helpers";
import { resourceIdPathParamsSchema } from "@/lib/api/schemas/request-schemas";

type IdParams = { id: string };

export function parseHomeworkId(params: IdParams) {
  const parsedParams = parseRouteInput(
    params,
    resourceIdPathParamsSchema,
    "Invalid homework ID",
  );
  return parsedParams instanceof Response ? parsedParams : parsedParams.id;
}

export function parseHomeworkSectionIds(input: {
  sectionId?: string;
  sectionIds?: string;
}) {
  const sectionIdList: number[] = [];
  if (input.sectionIds) {
    for (const value of input.sectionIds.split(",")) {
      const id = parseInteger(value.trim());
      if (id) sectionIdList.push(id);
    }
  } else if (input.sectionId) {
    const id = parseInteger(input.sectionId);
    if (id) sectionIdList.push(id);
  }

  return sectionIdList.length > 0
    ? sectionIdList
    : badRequest("Invalid section - provide sectionId or sectionIds");
}

export function homeworkSectionFilter(sectionIds: number[]) {
  return sectionIds.length === 1
    ? { sectionId: sectionIds[0] }
    : { sectionId: { in: sectionIds } };
}

export function homeworkIncludeForViewer(viewerUserId: string | null) {
  return {
    section: {
      include: {
        course: true,
        semester: true,
      },
    },
    description: true,
    createdBy: {
      select: { id: true, name: true, username: true, image: true },
    },
    updatedBy: {
      select: { id: true, name: true, username: true, image: true },
    },
    deletedBy: {
      select: { id: true, name: true, username: true, image: true },
    },
    _count: {
      select: {
        comments: { where: { status: { not: "deleted" } } },
      },
    },
    ...(viewerUserId
      ? {
          homeworkCompletions: {
            where: { userId: viewerUserId },
            select: { completedAt: true },
          },
        }
      : {}),
  } satisfies Prisma.HomeworkInclude;
}

export function homeworkResponseItem<
  Homework extends {
    _count: { comments: number };
    homeworkCompletions?: Array<{ completedAt: Date | string | null }>;
  },
>(homework: Homework) {
  const { homeworkCompletions, _count, ...rest } = homework;
  return {
    ...rest,
    completion: homeworkCompletions?.[0] ?? null,
    commentCount: _count.comments,
  };
}
