import type { AppLocale } from "@/i18n/config";
import {
  dashboardExamMetadataLabels,
  dashboardNameSecondary,
} from "./dashboard-controller-display";
import type { ExamRow } from "./dashboard-controller-helpers";

export function createDashboardDisplayActions(input: {
  getCountLabel: () => string;
  getFinalLabel: () => string;
  getLocale: () => AppLocale;
  getMidtermLabel: () => string;
}) {
  return {
    examMetadataLabels(exam: ExamRow) {
      return dashboardExamMetadataLabels(exam, {
        count: input.getCountLabel(),
        final: input.getFinalLabel(),
        midterm: input.getMidtermLabel(),
      });
    },
    nameSecondary(
      item?: {
        namePrimary?: string | null;
        nameCn?: string | null;
        nameEn?: string | null;
      } | null,
    ) {
      return dashboardNameSecondary(item, input.getLocale());
    },
  };
}
