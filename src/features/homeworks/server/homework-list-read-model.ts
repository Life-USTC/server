import type { AppLocale } from "@/i18n/config";
import { DEFAULT_LOCALE } from "@/i18n/config";
import { getViewerContext } from "@/lib/auth/viewer-context";
import { getPrisma, prisma, withUserDbContext } from "@/lib/db/prisma";
import { paginatedQuery } from "@/lib/query-pagination";
import {
  attachHomeworkCompletionsForViewer,
  homeworkItemInclude,
  homeworkItemResponse,
  withHomeworkCompletionsForViewer,
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

type SectionHomeworkPageInput = SectionHomeworkItemInput & {
  pagination: { page: number; pageSize: number };
};

type SectionHomeworkPageWithAuditInput = SectionHomeworkListWithAuditInput & {
  pagination: { page: number; pageSize: number };
};

type HomeworkSectionReferencesInput = {
  sectionId?: number | null;
  sectionIds?: readonly number[];
  sectionJwId?: number | null;
};

type HomeworkSectionReferencesError = "invalid" | "not_found";

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

export async function resolveHomeworkSectionIds({
  sectionId,
  sectionIds,
  sectionJwId,
}: HomeworkSectionReferencesInput): Promise<
  | { ok: true; sectionIds: number[] }
  | { ok: false; error: HomeworkSectionReferencesError }
> {
  const resolvedSectionIds = [...(sectionIds ?? [])];
  if (sectionId != null) {
    resolvedSectionIds.push(sectionId);
  }

  if (sectionJwId != null) {
    const section = await prisma.section.findUnique({
      where: { jwId: sectionJwId },
      select: { id: true },
    });
    if (!section) {
      return { ok: false, error: "not_found" };
    }
    resolvedSectionIds.push(section.id);
  }

  return resolvedSectionIds.length > 0
    ? { ok: true, sectionIds: resolvedSectionIds }
    : { ok: false, error: "invalid" };
}

export async function listSectionHomeworkItems({
  includeDeleted = false,
  locale = DEFAULT_LOCALE,
  sectionIds,
  viewerUserId,
}: SectionHomeworkItemInput) {
  const loadHomeworks = () =>
    getPrisma(locale).homework.findMany({
      where: {
        ...homeworkSectionWhere(sectionIds),
        ...(includeDeleted ? {} : { deletedAt: null }),
      },
      include: homeworkItemInclude(),
      orderBy: [{ submissionDueAt: "asc" }, { createdAt: "desc" }],
    });

  if (!viewerUserId) {
    const homeworks = await loadHomeworks();
    return attachHomeworkCompletionsForViewer(homeworks, []).map(
      homeworkItemResponse,
    );
  }

  const [homeworks, completions] = await Promise.all([
    loadHomeworks(),
    withUserDbContext(viewerUserId, (tx) =>
      tx.homeworkCompletion.findMany({
        where: {
          userId: viewerUserId,
          homework: {
            ...homeworkSectionWhere(sectionIds),
            ...(includeDeleted ? {} : { deletedAt: null }),
          },
        },
        select: { homeworkId: true, completedAt: true },
      }),
    ),
  ]);

  return attachHomeworkCompletionsForViewer(homeworks, completions).map(
    homeworkItemResponse,
  );
}

export async function listSectionHomeworkPage({
  includeDeleted = false,
  locale = DEFAULT_LOCALE,
  pagination,
  sectionIds,
  viewerUserId,
}: SectionHomeworkPageInput) {
  const client = getPrisma(locale);
  const where = {
    ...homeworkSectionWhere(sectionIds),
    ...(includeDeleted ? {} : { deletedAt: null }),
  };
  const page = await paginatedQuery(
    (skip, take) =>
      client.homework.findMany({
        where,
        include: homeworkItemInclude(),
        orderBy: [{ submissionDueAt: "asc" }, { createdAt: "desc" }],
        skip,
        take,
      }),
    () => client.homework.count({ where }),
    pagination.page,
    pagination.pageSize,
  );
  const homeworks = await withHomeworkCompletionsForViewer(
    page.data,
    viewerUserId,
  );
  return { ...page, data: homeworks.map(homeworkItemResponse) };
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
  const [viewer, homeworks, auditLogs] = await Promise.all([
    getViewerContext({
      includeAdmin: true,
      userId: userId ?? null,
    }),
    listSectionHomeworkItems({
      includeDeleted,
      locale,
      sectionIds,
      viewerUserId: userId,
    }),
    listSectionHomeworkAuditLogs(sectionIds),
  ]);

  return { viewer, homeworks, auditLogs };
}

export async function listSectionHomeworkPageWithAudit({
  includeDeleted = false,
  locale = DEFAULT_LOCALE,
  pagination,
  sectionIds,
  userId,
}: SectionHomeworkPageWithAuditInput) {
  const [viewer, page, auditLogs] = await Promise.all([
    getViewerContext({
      includeAdmin: true,
      userId: userId ?? null,
    }),
    listSectionHomeworkPage({
      includeDeleted,
      locale,
      pagination,
      sectionIds,
      viewerUserId: userId,
    }),
    listSectionHomeworkAuditLogs(sectionIds),
  ]);

  return { ...page, viewer, auditLogs };
}
