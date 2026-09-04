import type {
  DashboardExamRow,
  DashboardExamSection,
  ExamLabels,
} from "./exam-types";
import { namePrimary } from "./localized-names";

export function examTypeLabel(
  value: number | null | undefined,
  labels: ExamLabels,
) {
  if (value === 1) return labels.midterm;
  if (value === 2) return labels.final;
  return "";
}

export function examMetadataLabels<Section extends DashboardExamSection>(
  exam: DashboardExamRow<Section>,
  labels: ExamLabels,
) {
  return [
    examTypeLabel(exam.examType, labels),
    namePrimary(exam.examBatch),
    exam.examTakeCount ? `${labels.count}: ${exam.examTakeCount}` : "",
  ].filter(Boolean);
}
