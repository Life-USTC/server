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
  setCreatePublishedAt: TimestampSetter;
  setCreateSubmissionDueAt: TimestampSetter;
  setCreateSubmissionStartAt: TimestampSetter;
  setEditPublishedAt: TimestampSetter;
  setEditSubmissionDueAt: TimestampSetter;
  setEditSubmissionStartAt: TimestampSetter;
}) {
  function semesterEnd() {
    return input.getSemesterDate("end");
  }

  function semesterStart() {
    return input.getSemesterDate("start");
  }

  return {
    applyCreateDueAtSemesterEnd() {
      const end = semesterEnd();
      if (end) input.setCreateSubmissionDueAt(homeworkDueAtSemesterEnd(end));
    },
    applyCreateDueInMonth() {
      input.setCreateSubmissionDueAt(homeworkDueInMonths(1));
    },
    applyCreateDueInWeek() {
      input.setCreateSubmissionDueAt(homeworkDueInDays(7));
    },
    applyCreatePublishNow() {
      input.setCreatePublishedAt(homeworkTimestampNow());
    },
    applyCreateStartAtSemesterStart() {
      const start = semesterStart();
      if (start) {
        input.setCreateSubmissionStartAt(homeworkStartAtSemesterStart(start));
      }
    },
    applyCreateStartNow() {
      input.setCreateSubmissionStartAt(homeworkTimestampNow());
    },
    applyEditDueAtSemesterEnd() {
      const end = semesterEnd();
      if (end) input.setEditSubmissionDueAt(homeworkDueAtSemesterEnd(end));
    },
    applyEditDueInMonth() {
      input.setEditSubmissionDueAt(homeworkDueInMonths(1));
    },
    applyEditDueInWeek() {
      input.setEditSubmissionDueAt(homeworkDueInDays(7));
    },
    applyEditPublishNow() {
      input.setEditPublishedAt(homeworkTimestampNow());
    },
    applyEditStartAtSemesterStart() {
      const start = semesterStart();
      if (start) {
        input.setEditSubmissionStartAt(homeworkStartAtSemesterStart(start));
      }
    },
    applyEditStartNow() {
      input.setEditSubmissionStartAt(homeworkTimestampNow());
    },
  };
}
