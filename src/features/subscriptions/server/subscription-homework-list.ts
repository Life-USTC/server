import { attachHomeworkCompletionsForViewer } from "@/features/homeworks/server/homework-read-model";
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

async function fetchSubscribedHomeworkDashboardItems(
  userId: string,
  query: ReturnType<typeof buildSubscribedHomeworkQuery>,
  locale: string,
): Promise<HomeworkWithSection[]> {
  const { homeworkIds, completions } = await withUserDbContext(
    userId,
    async (tx) => {
      const scopedHomeworks = await tx.homework.findMany({
        ...query,
        select: { id: true },
      });
      const idsForCompletions = scopedHomeworks.map((homework) => homework.id);
      if (idsForCompletions.length === 0) {
        return { homeworkIds: [] as string[], completions: [] };
      }
      const completionRows = await tx.homeworkCompletion.findMany({
        where: {
          userId,
          homeworkId: { in: idsForCompletions },
        },
        select: { homeworkId: true, completedAt: true },
      });
      return {
        homeworkIds: idsForCompletions,
        completions: completionRows,
      };
    },
  );
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

export async function listDueSoonSubscribedHomeworksWithCount(
  userId: string,
  {
    dueAtFrom,
    dueAtTo,
    locale = DEFAULT_LOCALE,
    limit,
    sectionIds,
  }: {
    dueAtFrom: Date;
    dueAtTo: Date;
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
      const where = query.where;
      const [total, items] = await Promise.all([
        withUserDbContext(userId, (tx) => tx.homework.count({ where })),
        fetchSubscribedHomeworkDashboardItems(userId, query, locale),
      ]);
      return { total, items };
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

      const { homeworkIds, completions } = await withUserDbContext(
        userId,
        async (tx) => {
          const scopedHomeworks = await tx.homework.findMany({
            ...query,
            select: { id: true },
          });
          const idsForCompletions = scopedHomeworks.map(
            (homework) => homework.id,
          );
          if (idsForCompletions.length === 0) {
            return { homeworkIds: [] as string[], completions: [] };
          }
          const completionRows = await tx.homeworkCompletion.findMany({
            where: {
              userId,
              homeworkId: { in: idsForCompletions },
            },
            select: { homeworkId: true, completedAt: true },
          });
          return {
            homeworkIds: idsForCompletions,
            completions: completionRows,
          };
        },
      );
      if (homeworkIds.length === 0) return [];

      const localizedPrisma = getPrisma(locale);
      const homeworks = await localizedPrisma.homework.findMany({
        where: { id: { in: homeworkIds } },
        include: buildSubscribedHomeworkInclude(includeEditors),
      });
      return orderHomeworksById(
        attachHomeworkCompletionsForViewer(homeworks, completions),
        homeworkIds,
      );
    },
    resolvedSectionIds,
  );
}
