<script lang="ts">
import type { WorkspaceRootCopy } from "@/features/workspace/lib/workspace-controller-helpers";
import CalendarTab from "./CalendarTab.svelte";
import type { WorkspaceCalendarTabProps } from "./workspace-calendar-component-types";
import type { FormatMessage } from "./workspace-component-types";

export let addDays: WorkspaceCalendarTabProps["addDays"];
export let addMonths: WorkspaceCalendarTabProps["addMonths"];
export let calendarData: WorkspaceCalendarTabProps["calendarData"];
export let calendarEventParts: WorkspaceCalendarTabProps["calendarEventParts"];
export let calendarEventsForDay: WorkspaceCalendarTabProps["calendarEventsForDay"];
export let calendarTimelineItemsForDay: WorkspaceCalendarTabProps["calendarTimelineItemsForDay"];
export let calendarExamChipFields: WorkspaceCalendarTabProps["calendarExamChipFields"];
export let calendarHomeworkChipFields: WorkspaceCalendarTabProps["calendarHomeworkChipFields"];
export let calendarHomeworkHref: WorkspaceCalendarTabProps["calendarHomeworkHref"];
export let calendarMonth: WorkspaceCalendarTabProps["calendarMonth"];
export let calendarSemesterId: WorkspaceCalendarTabProps["calendarSemesterId"];
export let calendarSemesterIndex: WorkspaceCalendarTabProps["calendarSemesterIndex"];
export let calendarSessionChipFields: WorkspaceCalendarTabProps["calendarSessionChipFields"];
export let calendarTodoChipFields: WorkspaceCalendarTabProps["calendarTodoChipFields"];
export let calendarView: WorkspaceCalendarTabProps["calendarView"];
export let calendarWeekLabel: WorkspaceCalendarTabProps["calendarWeekLabel"];
export let calendarWeekStart: WorkspaceCalendarTabProps["calendarWeekStart"];
export let calendarWeekdayLabels: WorkspaceCalendarTabProps["calendarWeekdayLabels"];
export let commonCopy: WorkspaceCalendarTabProps["commonCopy"];
export let copy: WorkspaceRootCopy;
export let workspaceCopy: WorkspaceCalendarTabProps["workspaceCopy"];
export let workspaceTabHref: WorkspaceCalendarTabProps["workspaceTabHref"];
export let formatMessage: FormatMessage;
export let monthWeeks: WorkspaceCalendarTabProps["monthWeeks"];
export let sectionCopy: WorkspaceCalendarTabProps["sectionCopy"];
export let sessionHref: WorkspaceCalendarTabProps["sessionHref"];
export let setCalendarMonth: WorkspaceCalendarTabProps["setCalendarMonth"];
export let setCalendarSemester: WorkspaceCalendarTabProps["setCalendarSemester"];
export let setCalendarView: WorkspaceCalendarTabProps["setCalendarView"];
export let setCalendarWeek: WorkspaceCalendarTabProps["setCalendarWeek"];
export let signedData: WorkspaceCalendarTabProps["signedData"];
export let subscriptionsCopy: WorkspaceCalendarTabProps["subscriptionsCopy"];
</script>

<CalendarTab
  {copy}
  {commonCopy}
  {workspaceCopy}
  {sectionCopy}
  {subscriptionsCopy}
  {calendarWeekdayLabels}
  {signedData}
  {workspaceTabHref}
  {formatMessage}
  {sessionHref}
  {setCalendarView}
  {setCalendarMonth}
  {setCalendarWeek}
  {setCalendarSemester}
  {addDays}
  {addMonths}
  {monthWeeks}
  {calendarEventsForDay}
  {calendarTimelineItemsForDay}
  {calendarWeekLabel}
  {calendarEventParts}
  {calendarHomeworkHref}
  {calendarSessionChipFields}
  {calendarExamChipFields}
  {calendarHomeworkChipFields}
  {calendarTodoChipFields}
  {calendarSemesterIndex}
  {calendarView}
  {calendarMonth}
  {calendarWeekStart}
  {calendarSemesterId}
  {calendarData}
/>
