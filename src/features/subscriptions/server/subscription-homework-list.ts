import { attachHomeworkCompletionsForViewer } from "@/features/homeworks/server/homework-read-model";
import type { Prisma } from "@/generated/prisma/client";
import { DEFAULT_LOCALE } from "@/i18n/config";
import { getPrisma, withUserDbContext } from "@/lib/db/prisma";
import type { HomeworkWithSection } from "./subscription-dashboard-types";
import { orderHomeworksById } from "./subscription-homework-query";
import {
  buildDashboardHomeworkSelect,
  buildSubscribedHomeworkInclude,
  buildSubscribedHomeworkQuery,
  type SubscribedHomeworkRecord,
} from "./subscription-homework-read-helpers";
import type { ListSubscribedHomeworksOptions } from "./subscription-homework-read-types";
import {
  getSubscribedSectionIdsForSemester,
  withSubscribedSections,
} from "./subscription-read-model-shared";

type SubscribedHomeworkIdsAndCompletions = {
  completions: Array<{ homeworkId: string; completedAt: Date }>;
  homeworkIds: string[];
};

type SubscribedHomeworkRlsSnapshot = SubscribedHomeworkIdsAndCompletions & {
  total: number;
};

async function fetchSubscribedHomeworkIdsAndCompletionsInTransaction(
  tx: Prisma.TransactionClient,
  userId: string,
  query: ReturnType<typeof buildSubscribedHomeworkQuery>,
): Promise<SubscribedHomeworkIdsAndCompletions> {
  const scopedHomeworks = await tx.homework.findMany({
    ...query,
    select: { id: true },
  });
  const homeworkIds = scopedHomeworks.map((homework) => homework.id);
  if (homeworkIds.length === 0) {
    return { homeworkIds: [], completions: [] };
  }

  const completions = await tx.homeworkCompletion.findMany({
    where: {
      userId,
      homeworkId: { in: homeworkIds },
    },
    select: { homeworkId: true, completedAt: true },
  });
  return { homeworkIds, completions };
}

export async function fetchSubscribedHomeworkRlsSnapshot(
  tx: Prisma.TransactionClient,
  userId: string,
  query: ReturnType<typeof buildSubscribedHomeworkQuery>,
  includeItems: boolean,
): Promise<SubscribedHomeworkRlsSnapshot> {
  const total = await tx.homework.count({ where: query.where });
  if (!includeItems) {
    return { total, homeworkIds: [], completions: [] };
  }

  const { homeworkIds, completions } =
    await fetchSubscribedHomeworkIdsAndCompletionsInTransaction(
      tx,
      userId,
      query,
    );
  return { total, homeworkIds, completions };
}

export async function localizeSubscribedHomeworkDashboardItems(
  snapshot: Pick<SubscribedHomeworkRlsSnapshot, "completions" | "homeworkIds">,
  locale: string,
): Promise<HomeworkWithSection[]> {
  const { homeworkIds, completions } = snapshot;
  if (homeworkIds.length === 0) return [];

  const localizedPrisma = getPrisma(locale);
  const homeworks = await localizedPrisma.homework.findMany({
    where: { id: { in: homeworkIds } },
    select: buildDashboardHomeworkSelect(),
  });
  return orderHomeworksById(
    attachHomeworkCompletionsForViewer(homeworks, completions),
    homeworkIds,
  );
}

async function fetchSubscribedHomeworkDashboardItems(
  userId: string,
  query: ReturnType<typeof buildSubscribedHomeworkQuery>,
  locale: string,
): Promise<HomeworkWithSection[]> {
  const snapshot = await withUserDbContext(userId, (tx) =>
    fetchSubscribedHomeworkIdsAndCompletionsInTransaction(tx, userId, query),
  );
  return localizeSubscribedHomeworkDashboardItems(snapshot, locale);
}

export async function listDueSoonSubscribedHomeworksWithCount(
  userId: string,
  {
    dueAtFrom,
    dueAtTo,
    includeItems = true,
    locale = DEFAULT_LOCALE,
    limit,
    sectionIds,
  }: {
    dueAtFrom: Date;
    dueAtTo: Date;
    includeItems?: boolean;
    locale?: string;
    limit?: number;
    sectionIds?: readonly number[];
  },
) {
  return withSubscribedSections(
    userId,
    async (ids) => {
      const query = buildSubscribedHomeworkQuery({
        completed: false,
        dueAtFrom,
        dueAtTo,
        includeDeleted: false,
        limit,
        requireDueDate: true,
        sectionIds: ids,
        userId,
      });
      const snapshot = await withUserDbContext(userId, (tx) =>
        fetchSubscribedHomeworkRlsSnapshot(tx, userId, query, includeItems),
      );
      const items = includeItems
        ? await localizeSubscribedHomeworkDashboardItems(snapshot, locale)
        : [];
      return { total: snapshot.total, items };
    },
    sectionIds,
    { total: 0, items: [] },
  );
}

export async function listSubscribedHomeworks(
  userId: string,
  options: ListSubscribedHomeworksOptions & { shape: "dashboard" },
): Promise<HomeworkWithSection[]>;
export async function listSubscribedHomeworks(
  userId: string,
  options?: ListSubscribedHomeworksOptions,
): Promise<SubscribedHomeworkRecord[]>;
export async function listSubscribedHomeworks(
  userId: string,
  {
    locale = DEFAULT_LOCALE,
    completed,
    includeDeleted = false,
    includeEditors = false,
    incompleteOrHasDueDate = false,
    limit,
    dueAtFrom,
    dueAtTo,
    requireDueDate = false,
    sectionIds,
    semesterId,
    shape = "full",
  }: ListSubscribedHomeworksOptions = {},
): Promise<HomeworkWithSection[] | SubscribedHomeworkRecord[]> {
  const resolvedSectionIds =
    semesterId !== undefined
      ? await getSubscribedSectionIdsForSemester(userId, semesterId)
      : sectionIds;

  return withSubscribedSections(
    userId,
    async (ids) => {
      const query = buildSubscribedHomeworkQuery({
        completed,
        dueAtFrom,
        dueAtTo,
        includeDeleted,
        incompleteOrHasDueDate,
        limit,
        requireDueDate,
        sectionIds: ids,
        userId,
      });

      if (shape === "dashboard") {
        return fetchSubscribedHomeworkDashboardItems(userId, query, locale);
      }

      const snapshot = await withUserDbContext(userId, (tx) =>
        fetchSubscribedHomeworkIdsAndCompletionsInTransaction(
          tx,
          userId,
          query,
        ),
      );
      if (snapshot.homeworkIds.length === 0) return [];

      const localizedPrisma = getPrisma(locale);
      const homeworks = await localizedPrisma.homework.findMany({
        where: { id: { in: snapshot.homeworkIds } },
        include: buildSubscribedHomeworkInclude(includeEditors),
      });
      return orderHomeworksById(
        attachHomeworkCompletionsForViewer(homeworks, snapshot.completions),
        snapshot.homeworkIds,
      );
    },
    resolvedSectionIds,
  );
}
