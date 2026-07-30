import { withHomeworkCompletionsForViewer } from "@/features/homeworks/server/homework-read-model";
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
      const scopedHomeworks = await withUserDbContext(userId, (tx) =>
        tx.homework.findMany({ ...query, select: { id: true } }),
      );
      const homeworkIds = scopedHomeworks.map((homework) => homework.id);
      if (homeworkIds.length === 0) return [];

      const localizedPrisma = getPrisma(locale);

      if (shape === "dashboard") {
        const homeworks = await localizedPrisma.homework.findMany({
          where: { id: { in: homeworkIds } },
          select: buildDashboardHomeworkSelect(),
        });
        return orderHomeworksById(
          await withHomeworkCompletionsForViewer(homeworks, userId),
          homeworkIds,
        );
      }

      const homeworks = await localizedPrisma.homework.findMany({
        where: { id: { in: homeworkIds } },
        include: buildSubscribedHomeworkInclude(includeEditors),
      });
      return orderHomeworksById(
        await withHomeworkCompletionsForViewer(homeworks, userId),
        homeworkIds,
      );
    },
    resolvedSectionIds,
  );
}
