import { resolveDashboardSections } from "./dashboard-helpers";
import type { resolveDashboardOverviewContext } from "./dashboard-overview-context";
import { buildOverviewSemesterLists } from "./dashboard-overview-semesters";
import type { OverviewDataOptions } from "./dashboard-overview-types";
import { listSubscribedDashboardSections } from "./subscription-read-model";

type DashboardOverviewContext = Awaited<
  ReturnType<typeof resolveDashboardOverviewContext>
>;
type DashboardSemesterContext = DashboardOverviewContext["semesterContext"];
type DashboardSemester = DashboardOverviewContext["semesters"][number];

export async function resolveDashboardOverviewSectionScope(input: {
  calendarSemesterId: OverviewDataOptions["calendarSemesterId"];
  currentSemester: DashboardSemesterContext["currentSemester"];
  gridSemesterRow: DashboardSemesterContext["gridSemesterRow"];
  isCalendarSemesterFromUrlValid: boolean;
  locale: string;
  scheduleDateEnd: DashboardSemesterContext["scheduleDateEnd"];
  scheduleDateStart: DashboardSemesterContext["scheduleDateStart"];
  sectionIds: OverviewDataOptions["sectionIds"];
  semesters: DashboardSemester[];
  userId: string;
}) {
  const allSections = await listSubscribedDashboardSections(input.userId, {
    locale: input.locale,
    dateFrom: input.scheduleDateStart,
    dateTo: input.scheduleDateEnd,
    detailSemesterIds: [
      input.currentSemester?.id,
      input.gridSemesterRow?.id,
    ].filter((id): id is number => id != null),
    sectionIds: input.sectionIds,
  });

  const {
    hasAnySelection,
    hasCurrentTermSelection,
    dashboardSections,
    dashboardSectionIds,
  } = resolveDashboardSections(allSections, input.currentSemester);

  const sectionsForCalendarGrid = input.gridSemesterRow
    ? allSections.filter(
        (section) => section.semester?.id === input.gridSemesterRow?.id,
      )
    : [];

  const homeworkSectionIds =
    input.isCalendarSemesterFromUrlValid && input.calendarSemesterId != null
      ? sectionsForCalendarGrid.map((section) => section.id)
      : dashboardSectionIds;

  const { calendarSemesterNavList, calendarSemesterPicker } =
    buildOverviewSemesterLists({
      allSections,
      semesters: input.semesters,
    });

  return {
    calendarSemesterNavList,
    calendarSemesterPicker,
    currentTermName: input.currentSemester?.nameCn ?? "—",
    dashboardSections,
    hasAnySelection,
    hasCurrentTermSelection,
    homeworkSectionIds,
    sectionsForCalendarGrid,
  };
}
