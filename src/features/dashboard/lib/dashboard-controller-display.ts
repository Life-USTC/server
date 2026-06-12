import type { AppLocale } from "@/i18n/config";
import type {
  ExamRow,
  SubscriptionsData,
} from "./dashboard-controller-helpers";
import { examMetadataLabels, flattenExamRows } from "./exams";
import { nameSecondary } from "./localized-names";

export function dashboardExamMetadataLabels(
  exam: ExamRow,
  copy: {
    count: string;
    final: string;
    midterm: string;
  },
) {
  return examMetadataLabels(exam, copy);
}

export function dashboardExamRows(
  subscriptions: SubscriptionsData,
  referenceNow: Date | string | null | undefined,
  copy: {
    dateFallback: string;
    notAvailable: string;
  },
) {
  return flattenExamRows(
    subscriptions,
    referenceNow instanceof Date ? referenceNow.toISOString() : referenceNow,
    copy,
  );
}

export function dashboardNameSecondary(
  item:
    | {
        namePrimary?: string | null;
        nameCn?: string | null;
        nameEn?: string | null;
      }
    | null
    | undefined,
  locale: AppLocale,
) {
  return nameSecondary(item, locale);
}
