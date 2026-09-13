import { getUserSubscriptionKinds } from "@/features/subscriptions/server/subscription-kind";
import { listSubscribedWorkspaceSections } from "@/features/subscriptions/server/subscription-read-model";
import { getMessages } from "@/i18n/messages.server";
import { resolveWorkspaceSections } from "./workspace-helpers";
import type { resolveWorkspaceOverviewContext } from "./workspace-overview-context";
import { buildOverviewSemesterLists } from "./workspace-overview-semesters";
import type { OverviewDataOptions } from "./workspace-overview-types";

type WorkspaceOverviewContext = Awaited<
  ReturnType<typeof resolveWorkspaceOverviewContext>
>;
type WorkspaceSemesterContext = WorkspaceOverviewContext["semesterContext"];
type WorkspaceSemester = WorkspaceOverviewContext["semesters"][number];

export async function resolveWorkspaceOverviewSectionScope(input: {
  calendarSemesterId: OverviewDataOptions["calendarSemesterId"];
  currentSemester: WorkspaceSemesterContext["currentSemester"];
  gridSemesterRow: WorkspaceSemesterContext["gridSemesterRow"];
  isCalendarSemesterFromUrlValid: boolean;
  locale: string;
  scheduleDateEnd: WorkspaceSemesterContext["scheduleDateEnd"];
  scheduleDateStart: WorkspaceSemesterContext["scheduleDateStart"];
  sectionIds: OverviewDataOptions["sectionIds"];
  semesters: WorkspaceSemester[];
  userId: string;
}) {
  const [sections, kinds, messages] = await Promise.all([
    listSubscribedWorkspaceSections(input.userId, {
      locale: input.locale,
      dateFrom: input.scheduleDateStart,
      dateTo: input.scheduleDateEnd,
      detailSemesterIds: [
        input.currentSemester?.id,
        input.gridSemesterRow?.id,
      ].filter((id): id is number => id != null),
      sectionIds: input.sectionIds,
    }),
    getUserSubscriptionKinds(input.userId),
    getMessages(input.locale),
  ]);
  const allSections = sections.map((section) => {
    const kind = kinds.get(section.id);
    return {
      ...section,
      badge:
        kind && kind !== "regular"
          ? messages.subscriptions.kindBadge[kind]
          : undefined,
    };
  });

  const {
    hasAnySelection,
    hasCurrentTermSelection,
    workspaceSections,
    workspaceSectionIds,
  } = resolveWorkspaceSections(allSections, input.currentSemester);

  const sectionsForCalendarGrid = input.gridSemesterRow
    ? allSections.filter(
        (section) => section.semester?.id === input.gridSemesterRow?.id,
      )
    : [];

  const homeworkSectionIds =
    input.isCalendarSemesterFromUrlValid && input.calendarSemesterId != null
      ? sectionsForCalendarGrid.map((section) => section.id)
      : workspaceSectionIds;

  const { calendarSemesterNavList, calendarSemesterPicker } =
    buildOverviewSemesterLists({
      allSections,
      semesters: input.semesters,
    });

  return {
    calendarSemesterNavList,
    calendarSemesterPicker,
    currentTermName: input.currentSemester?.nameCn ?? "—",
    workspaceSections,
    hasAnySelection,
    hasCurrentTermSelection,
    homeworkSectionIds,
    sectionsForCalendarGrid,
  };
}
