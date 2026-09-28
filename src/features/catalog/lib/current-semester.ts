import type { Prisma } from "@/generated/prisma/client";
import { parseDateInput } from "@/lib/time/parse-date-input";
import { formatShanghaiDate } from "@/lib/time/shanghai-format";

type SemesterWithDateRange = {
  startDate: Date | null;
  endDate: Date | null;
};

const startTime = (s: SemesterWithDateRange) =>
  s.startDate?.getTime() ?? Number.NEGATIVE_INFINITY;

const endTime = (s: SemesterWithDateRange) =>
  s.endDate?.getTime() ?? Number.POSITIVE_INFINITY;

const byMostSpecific = <TSemester extends SemesterWithDateRange>(
  a: TSemester,
  b: TSemester,
) => startTime(b) - startTime(a) || endTime(a) - endTime(b);

export const buildCurrentSemesterWhere = (
  referenceDate: Date,
): Prisma.SemesterWhereInput => {
  const dateOnlyReference = parseDateInput(formatShanghaiDate(referenceDate));
  if (!(dateOnlyReference instanceof Date)) {
    throw new TypeError("Invalid current-semester reference date");
  }
  return {
    startDate: { lte: dateOnlyReference },
    endDate: { gte: dateOnlyReference },
  };
};

export const currentSemesterDateKey = (referenceDate: Date) =>
  formatShanghaiDate(referenceDate);

export const selectCurrentSemesterFromList = <
  TSemester extends SemesterWithDateRange,
>(
  semesters: TSemester[],
  referenceDate: Date,
): TSemester | null => {
  const dateOnlyReference = parseDateInput(formatShanghaiDate(referenceDate));
  if (!(dateOnlyReference instanceof Date)) {
    throw new TypeError("Invalid current-semester reference date");
  }
  return (
    semesters
      .filter(
        (semester) =>
          semester.startDate != null &&
          semester.endDate != null &&
          semester.startDate <= dateOnlyReference &&
          semester.endDate >= dateOnlyReference,
      )
      .sort(byMostSpecific)
      .at(0) ?? null
  );
};
