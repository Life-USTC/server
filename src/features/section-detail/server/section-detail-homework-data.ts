import type { Prisma } from "@/generated/prisma/client";
import { getViewerContext } from "@/lib/auth/viewer-context";
import { toShanghaiIsoString } from "@/lib/time/serialize-date-output";

export async function getSectionHomeworkData(
  sectionId: number,
  userId: string | null,
) {
  const [{ getPrisma, prisma }, homeworkViewer] = await Promise.all([
    import("@/lib/db/prisma"),
    getViewerContext({ includeAdmin: true, userId }),
  ]);

  const homeworkInclude = {
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
    ...(homeworkViewer.userId
      ? {
          homeworkCompletions: {
            where: { userId: homeworkViewer.userId },
            select: { completedAt: true },
          },
        }
      : {}),
  } satisfies Prisma.HomeworkInclude;

  const [homeworks, auditLogs] = await Promise.all([
    getPrisma("zh-cn").homework.findMany({
      where: { sectionId, deletedAt: null },
      include: homeworkInclude,
      orderBy: [{ submissionDueAt: "asc" }, { createdAt: "desc" }],
    }),
    prisma.homeworkAuditLog.findMany({
      where: { sectionId },
      include: {
        actor: {
          select: { id: true, name: true, username: true, image: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  return {
    viewer: homeworkViewer,
    homeworks: homeworks.map((homework) => {
      const { homeworkCompletions, _count, ...rest } = homework;
      return {
        ...rest,
        createdAt: toShanghaiIsoString(rest.createdAt),
        updatedAt: toShanghaiIsoString(rest.updatedAt),
        deletedAt: rest.deletedAt ? toShanghaiIsoString(rest.deletedAt) : null,
        publishedAt: rest.publishedAt
          ? toShanghaiIsoString(rest.publishedAt)
          : null,
        submissionStartAt: rest.submissionStartAt
          ? toShanghaiIsoString(rest.submissionStartAt)
          : null,
        submissionDueAt: rest.submissionDueAt
          ? toShanghaiIsoString(rest.submissionDueAt)
          : null,
        description: rest.description
          ? {
              ...rest.description,
              createdAt: toShanghaiIsoString(rest.description.createdAt),
              updatedAt: toShanghaiIsoString(rest.description.updatedAt),
              lastEditedAt: rest.description.lastEditedAt
                ? toShanghaiIsoString(rest.description.lastEditedAt)
                : null,
            }
          : null,
        completion: homeworkCompletions?.[0]
          ? {
              completedAt: toShanghaiIsoString(
                homeworkCompletions[0].completedAt,
              ),
            }
          : null,
        commentCount: _count.comments,
      };
    }),
    auditLogs: auditLogs.map((log) => ({
      ...log,
      createdAt: toShanghaiIsoString(log.createdAt),
    })),
  };
}
