import type { AppLocale } from "@/i18n/config";
import { DEFAULT_LOCALE } from "@/i18n/config";
import { getViewerContext } from "@/lib/auth/viewer-context";
import { getPrisma, prisma } from "@/lib/db/prisma";
import {
  homeworkItemIncludeForViewer,
  homeworkItemResponse,
} from "./homework-read-model";

type SectionHomeworkListInput = {
  includeDeleted?: boolean;
  locale?: AppLocale;
  sectionIds: readonly number[];
};

type SectionHomeworkItemInput = SectionHomeworkListInput & {
  viewerUserId?: string | null;
};

type SectionHomeworkListWithAuditInput = SectionHomeworkListInput & {
  userId?: string | null;
};

const homeworkAuditActorInclude = {
  actor: {
    select: { id: true, name: true, username: true, image: true },
  },
} as const;

export function homeworkSectionWhere(sectionIds: readonly number[]) {
  return sectionIds.length === 1
    ? { sectionId: sectionIds[0] }
    : { sectionId: { in: [...sectionIds] } };
}

export async function listSectionHomeworkItems({
  includeDeleted = false,
  locale = DEFAULT_LOCALE,
  sectionIds,
  viewerUserId,
}: SectionHomeworkItemInput) {
  const homeworks = await getPrisma(locale).homework.findMany({
    where: {
      ...homeworkSectionWhere(sectionIds),
      ...(includeDeleted ? {} : { deletedAt: null }),
    },
    include: homeworkItemIncludeForViewer(viewerUserId),
    orderBy: [{ submissionDueAt: "asc" }, { createdAt: "desc" }],
  });

  return homeworks.map(homeworkItemResponse);
}

export function listSectionHomeworkAuditLogs(sectionIds: readonly number[]) {
  return prisma.homeworkAuditLog.findMany({
    where: homeworkSectionWhere(sectionIds),
    include: homeworkAuditActorInclude,
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export async function listSectionHomeworksWithAudit({
  includeDeleted = false,
  locale = DEFAULT_LOCALE,
  sectionIds,
  userId,
}: SectionHomeworkListWithAuditInput) {
  const viewer = await getViewerContext({
    includeAdmin: true,
    userId: userId ?? null,
  });

  const [homeworks, auditLogs] = await Promise.all([
    listSectionHomeworkItems({
      includeDeleted,
      locale,
      sectionIds,
      viewerUserId: viewer.userId,
    }),
    listSectionHomeworkAuditLogs(sectionIds),
  ]);

  return { viewer, homeworks, auditLogs };
}
