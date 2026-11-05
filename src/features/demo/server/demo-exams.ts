import {
  DEMO_REFERENCE_NOW,
  type DemoIdentity,
} from "@/features/demo/lib/demo-types";
import type { SubscriptionsTabData } from "@/features/subscriptions/server/subscription-tab-read-model";
import { flattenExamRows } from "@/features/workspace/lib/exams";
import type { AppLocale } from "@/i18n/config";
import { getDemoCatalogSection } from "./demo-catalog";
import { getDemoSubscriptionsTabData } from "./demo-subscriptions";

/** The exams page and section detail API share the same catalog records. */
export function getDemoExamsTabData(
  identity: DemoIdentity,
  locale: AppLocale,
): SubscriptionsTabData {
  const data = getDemoSubscriptionsTabData(identity, locale);
  return {
    ...data,
    subscriptions: data.subscriptions.map((subscription) => ({
      ...subscription,
      sections: subscription.sections.map((section) => ({
        ...section,
        exams: (getDemoCatalogSection(section.jwId, locale)?.exams ?? []).map(
          (exam) => ({
            id: exam.id,
            examDate: exam.examDate,
            startTime: exam.startTime,
            endTime: exam.endTime,
            examType: exam.examType,
            examMode: exam.examMode,
            examTakeCount: exam.examTakeCount,
            examBatch: exam.examBatch,
            examRooms: exam.examRooms.map(({ room, count }) => ({
              room,
              count,
            })),
          }),
        ),
      })),
    })),
  };
}

export function getDemoUpcomingExamsCount(identity: DemoIdentity) {
  return flattenExamRows(
    getDemoExamsTabData(identity, "zh-cn"),
    DEMO_REFERENCE_NOW,
    {
      dateFallback: "",
      notAvailable: "",
    },
  ).filter((exam) => exam.examDate && !exam.completed).length;
}
