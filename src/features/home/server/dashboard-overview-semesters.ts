import { selectCurrentSemesterFromList } from "@/lib/current-semester";
import { shanghaiDayjs } from "@/lib/time/shanghai-dayjs";

type OverviewSemester = {
  id: number;
  nameCn: string | null;
  startDate: Date | null;
  endDate: Date | null;
};

export function resolveOverviewSemesterContext({
  calendarSemesterId,
  referenceDate,
  referenceNow,
  semesters,
}: {
  calendarSemesterId?: number;
  referenceDate: Date;
  referenceNow: ReturnType<typeof shanghaiDayjs>;
  semesters: OverviewSemester[];
}) {
  const currentSemester = selectCurrentSemesterFromList(
    semesters,
    referenceDate,
  );
  const calendarSemesterFromUrlValid =
    calendarSemesterId != null &&
    semesters.some((semester) => semester.id === calendarSemesterId);
  const gridSemesterRow =
    calendarSemesterFromUrlValid && calendarSemesterId != null
      ? (semesters.find((semester) => semester.id === calendarSemesterId) ??
        null)
      : currentSemester &&
          semesters.some((semester) => semester.id === currentSemester.id)
        ? (semesters.find((semester) => semester.id === currentSemester.id) ??
          null)
        : null;

  const fallbackStart = referenceNow.subtract(6, "month").toDate();
  const fallbackEnd = referenceNow.add(6, "month").toDate();
  const candidateStarts = [
    currentSemester?.startDate,
    gridSemesterRow?.startDate,
  ].filter((date): date is Date => date != null);
  const candidateEnds = [
    currentSemester?.endDate,
    gridSemesterRow?.endDate,
  ].filter((date): date is Date => date != null);
  const scheduleDateStart =
    candidateStarts.length > 0
      ? new Date(Math.min(...candidateStarts.map((date) => date.getTime())))
      : fallbackStart;
  const scheduleDateEnd =
    candidateEnds.length > 0
      ? new Date(Math.max(...candidateEnds.map((date) => date.getTime())))
      : fallbackEnd;

  return {
    calendarSemesterFromUrlValid,
    currentSemester,
    gridSemesterRow,
    scheduleDateStart,
    scheduleDateEnd,
  };
}

export function buildOverviewSemesterLists({
  allSections,
  semesters,
}: {
  allSections: Array<{ semester?: { id?: number | null } | null }>;
  semesters: OverviewSemester[];
}) {
  const subscribedSemesterIds = new Set(
    allSections
      .map((section) => section.semester?.id)
      .filter((id): id is number => id != null),
  );
  const calendarSemesterPicker = semesters
    .filter((semester) => subscribedSemesterIds.has(semester.id))
    .sort(
      (left, right) =>
        shanghaiDayjs(left.startDate).valueOf() -
        shanghaiDayjs(right.startDate).valueOf(),
    )
    .map((semester) => ({ id: semester.id, nameCn: semester.nameCn ?? "—" }));

  const calendarSemesterNavList = semesters.map((semester) => ({
    id: semester.id,
    nameCn: semester.nameCn ?? "—",
  }));

  return { calendarSemesterPicker, calendarSemesterNavList };
}
