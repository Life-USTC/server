import {
  homeworkDueAtSemesterEnd,
  homeworkDueInDays,
  homeworkDueInMonths,
  homeworkStartAtSemesterStart,
  homeworkTimestampNow,
} from "./section-detail-controller-helpers";

type SemesterDateKind = "start" | "end";
type TimestampSetter = (value: string) => void;

export function createSectionHomeworkTimestampActions(input: {
  getSemesterDate: (kind: SemesterDateKind) => Date | string | null | undefined;
  setPublishedAt: TimestampSetter;
  setSubmissionDueAt: TimestampSetter;
  setSubmissionStartAt: TimestampSetter;
}) {
  function semesterEnd() {
    return input.getSemesterDate("end");
  }

  function semesterStart() {
    return input.getSemesterDate("start");
  }

  return {
    dueAtSemesterEnd() {
      const end = semesterEnd();
      if (end) input.setSubmissionDueAt(homeworkDueAtSemesterEnd(end));
    },
    dueInMonth() {
      input.setSubmissionDueAt(homeworkDueInMonths(1));
    },
    dueInWeek() {
      input.setSubmissionDueAt(homeworkDueInDays(7));
    },
    publishNow() {
      input.setPublishedAt(homeworkTimestampNow());
    },
    startAtSemesterStart() {
      const start = semesterStart();
      if (start) {
        input.setSubmissionStartAt(homeworkStartAtSemesterStart(start));
      }
    },
    startNow() {
      input.setSubmissionStartAt(homeworkTimestampNow());
    },
  };
}

export type HomeworkShortcuts = ReturnType<
  typeof createSectionHomeworkTimestampActions
>;
