import {
  examDateTime,
  examReferenceNow,
  formatDateOnly,
} from "./exam-date-display";
import type {
  DashboardExam,
  DashboardExamRow,
  DashboardExamSection,
  DashboardExamSubscriptions,
  ExamFilter,
} from "./exam-types";
import { namePrimary } from "./localized-names";

export function flattenExamRows<Section extends DashboardExamSection>(
  subscriptions: DashboardExamSubscriptions<Section>,
  referenceNow: string | null | undefined,
  options: {
    dateFallback: string;
    notAvailable: string;
  },
) {
  const now = examReferenceNow(referenceNow);
  const rows = subscriptions.subscriptions.flatMap((subscription) =>
    subscription.sections.flatMap((section) =>
      section.exams.filter(examHasDetails).map((exam) => {
        const end = examDateTime(
          exam.examDate,
          exam.endTime ?? exam.startTime,
          options.dateFallback,
        );
        return {
          id: exam.id,
          section,
          courseName: namePrimary(section.course) || options.notAvailable,
          dateKey: exam.examDate
            ? formatDateOnly(exam.examDate, options.dateFallback)
            : null,
          startTime: exam.startTime,
          endTime: exam.endTime,
          examType: exam.examType,
          examMode: exam.examMode,
          examTakeCount: exam.examTakeCount,
          examBatch: exam.examBatch,
          rooms: exam.examRooms
            .map((room) => room.room)
            .filter(Boolean)
            .join(", "),
          completed: end ? end < now : false,
        };
      }),
    ),
  );

  return rows.sort((left, right) => {
    if (left.dateKey && right.dateKey) {
      const dateDiff = left.dateKey.localeCompare(right.dateKey);
      if (dateDiff !== 0) return dateDiff;
      return (
        (left.startTime ?? Number.MAX_SAFE_INTEGER) -
        (right.startTime ?? Number.MAX_SAFE_INTEGER)
      );
    }
    if (left.dateKey) return -1;
    if (right.dateKey) return 1;
    return left.id - right.id;
  });
}

export function filterExamRows<Section extends DashboardExamSection>(
  rows: DashboardExamRow<Section>[],
  filter: ExamFilter,
) {
  if (filter === "all") return rows;
  return rows.filter((exam) =>
    filter === "completed" ? exam.completed : !exam.completed,
  );
}

function examHasDetails(exam: DashboardExam) {
  return Boolean(
    exam.examDate ||
      exam.startTime !== null ||
      exam.endTime !== null ||
      exam.examType !== null ||
      exam.examMode?.trim() ||
      exam.examTakeCount !== null ||
      namePrimary(exam.examBatch) ||
      exam.examRooms.some((room) => room.room.trim() || room.count > 0),
  );
}
