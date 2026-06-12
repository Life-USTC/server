import { DEFAULT_LOCALE } from "@/i18n/config";
import { getPrisma } from "@/lib/db/prisma";
import type { HomeworkWithSection } from "./dashboard-types";
import {
  buildDashboardHomeworkSelect,
  buildSubscribedHomeworkInclude,
  buildSubscribedHomeworkQuery,
  type SubscribedHomeworkRecord,
} from "./subscription-homework-read-helpers";
import type { ListSubscribedHomeworksOptions } from "./subscription-homework-read-types";
import { withSubscribedSections } from "./subscription-read-model-shared";

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
    limit,
    dueAtFrom,
    dueAtTo,
    requireDueDate = false,
    sectionIds,
    shape = "full",
  }: ListSubscribedHomeworksOptions = {},
): Promise<HomeworkWithSection[] | SubscribedHomeworkRecord[]> {
  return withSubscribedSections(
    userId,
    async (ids) => {
      const localizedPrisma = getPrisma(locale);
      const query = buildSubscribedHomeworkQuery({
        completed,
        dueAtFrom,
        dueAtTo,
        includeDeleted,
        limit,
        requireDueDate,
        sectionIds: ids,
        userId,
      });

      if (shape === "dashboard") {
        return localizedPrisma.homework.findMany({
          ...query,
          select: buildDashboardHomeworkSelect(userId),
        }) as unknown as Promise<HomeworkWithSection[]>;
      }

      return localizedPrisma.homework.findMany({
        ...query,
        include: buildSubscribedHomeworkInclude(userId, includeEditors),
      });
    },
    sectionIds,
  );
}
