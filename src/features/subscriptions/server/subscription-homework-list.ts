import {
  attachHomeworkCompletionsForViewer,
  withHomeworkCompletionRequiredForViewer,
} from "@/features/homeworks/server/homework-read-model";
import type { Prisma } from "@/generated/prisma/client";
import { DEFAULT_LOCALE } from "@/i18n/config";
import { getPrisma, withUserDbContext } from "@/lib/db/prisma";
import { orderHomeworksById } from "./subscription-homework-query";
import {
  buildSubscribedHomeworkInclude,
  buildSubscribedHomeworkQuery,
  buildWorkspaceHomeworkSelect,
  type SubscribedHomeworkRecord,
} from "./subscription-homework-read-helpers";
import type { ListSubscribedHomeworksOptions } from "./subscription-homework-read-types";
import {
  getSubscribedSectionIdsForSemester,
  withSubscribedSections,
} from "./subscription-read-model-shared";
import type { HomeworkWithSection } from "./subscription-workspace-types";

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
  if (!includeItems) {
    const total = await tx.homework.count({ where: query.where });
    return { total, homeworkIds: [], completions: [] };
  }

  const [total, { homeworkIds, completions }] = await Promise.all([
    tx.homework.count({ where: query.where }),
    fetchSubscribedHomeworkIdsAndCompletionsInTransaction(tx, userId, query),
  ]);
  return { total, homeworkIds, completions };
}

export async function localizeSubscribedHomeworkWorkspaceItems(
  snapshot: Pick<SubscribedHomeworkRlsSnapshot, "completions" | "homeworkIds">,
  locale: string,
  userId: string,
): Promise<HomeworkWithSection[]> {
  const { homeworkIds, completions } = snapshot;
  if (homeworkIds.length === 0) return [];

  const localizedPrisma = getPrisma(locale);
  const homeworks = await localizedPrisma.homework.findMany({
    where: { id: { in: homeworkIds } },
    select: buildWorkspaceHomeworkSelect(),
  });
  const withCompletions = attachHomeworkCompletionsForViewer(
    homeworks,
    completions,
  );
  return orderHomeworksById(
    await withHomeworkCompletionRequiredForViewer(withCompletions, userId),
    homeworkIds,
  );
}

async function fetchSubscribedHomeworkWorkspaceItems(
  userId: string,
  query: ReturnType<typeof buildSubscribedHomeworkQuery>,
  locale: string,
): Promise<HomeworkWithSection[]> {
  const snapshot = await withUserDbContext(userId, (tx) =>
    fetchSubscribedHomeworkIdsAndCompletionsInTransaction(tx, userId, query),
  );
  return localizeSubscribedHomeworkWorkspaceItems(snapshot, locale, userId);
}

export async function listDueSoonSubscribedHomeworksWithCount(
  userId: string,
  {
    dueAtFrom,
    dueAtTo,
    includeItems = true,
    locale = DEFAULT_LOCALE,
    limit,
    now = new Date(),
    sectionIds,
  }: {
    dueAtFrom: Date;
    dueAtTo: Date;
    includeItems?: boolean;
    locale?: string;
    limit?: number;
    now?: Date;
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
        now,
        requireDueDate: true,
        sectionIds: ids,
        userId,
      });
      const snapshot = await withUserDbContext(userId, (tx) =>
        fetchSubscribedHomeworkRlsSnapshot(tx, userId, query, includeItems),
      );
      const items = includeItems
        ? await localizeSubscribedHomeworkWorkspaceItems(
            snapshot,
            locale,
            userId,
          )
        : [];
      return { total: snapshot.total, items };
    },
    sectionIds,
    { total: 0, items: [] },
  );
}

export async function listSubscribedHomeworks(
  userId: string,
  options: ListSubscribedHomeworksOptions & { shape: "workspace" },
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
    now = new Date(),
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
        now,
        requireDueDate,
        sectionIds: ids,
        userId,
      });

      if (shape === "workspace") {
        return fetchSubscribedHomeworkWorkspaceItems(userId, query, locale);
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
      const withCompletions = attachHomeworkCompletionsForViewer(
        homeworks,
        snapshot.completions,
      );
      return orderHomeworksById(
        await withHomeworkCompletionRequiredForViewer(withCompletions, userId),
        snapshot.homeworkIds,
      );
    },
    resolvedSectionIds,
  );
}
