import type { Prisma } from "@/generated/prisma/client";

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
): Prisma.SemesterWhereInput => ({
  startDate: { lte: referenceDate },
  endDate: { gte: referenceDate },
});

export const selectCurrentSemesterFromList = <
  TSemester extends SemesterWithDateRange,
>(
  semesters: TSemester[],
  referenceDate: Date,
): TSemester | null => {
  const current = semesters
    .filter(
      (s) =>
        (!s.startDate || s.startDate <= referenceDate) &&
        (!s.endDate || s.endDate >= referenceDate),
    )
    .sort(byMostSpecific);
  if (current[0]) return current[0];

  const future = semesters
    .filter((s) => s.startDate && s.startDate > referenceDate)
    .sort((a, b) => startTime(a) - startTime(b) || endTime(a) - endTime(b));
  if (future[0]) return future[0];

  return [...semesters].sort(byMostSpecific).at(0) ?? null;
};
