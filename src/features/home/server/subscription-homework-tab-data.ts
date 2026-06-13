import { DEFAULT_LOCALE } from "@/i18n/config";
import { listSubscribedHomeworks } from "./subscription-homework-list";
import {
  type HomeworkSummaryItem,
  homeworkSummaryFromRecord,
} from "./subscription-homework-read-helpers";
import { listSubscribedSectionOptions } from "./subscription-section-options";

export type { HomeworkSummaryItem };

export async function getHomeworksTabData(
  userId: string,
  locale = DEFAULT_LOCALE,
  options: { sectionIds?: readonly number[] } = {},
) {
  const [sections, homeworks] = await Promise.all([
    listSubscribedSectionOptions(userId, locale, {
      sectionIds: options.sectionIds,
    }),
    listSubscribedHomeworks(userId, { locale, sectionIds: options.sectionIds }),
  ]);

  const homeworkSummaries: HomeworkSummaryItem[] = homeworks.map(
    homeworkSummaryFromRecord,
  );

  return { homeworkSummaries, sections };
}
