import type { AppLocale } from "@/i18n/config";
import {
  workspaceExamMetadataLabels,
  workspaceNameSecondary,
} from "./workspace-controller-display";
import type { ExamRow } from "./workspace-controller-helpers";

export function createWorkspaceDisplayActions(input: {
  getCountLabel: () => string;
  getFinalLabel: () => string;
  getLocale: () => AppLocale;
  getMidtermLabel: () => string;
}) {
  return {
    examMetadataLabels(exam: ExamRow) {
      return workspaceExamMetadataLabels(exam, {
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
      return workspaceNameSecondary(item, input.getLocale());
    },
  };
}
