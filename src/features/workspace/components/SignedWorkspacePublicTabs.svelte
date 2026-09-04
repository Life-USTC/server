<script lang="ts">
import type { WorkspaceBusCopy } from "@/features/workspace/lib/bus-tab-types";
import type {
  SignedLinkGroup,
  WorkspaceLinkPinSubmit,
} from "@/features/workspace/lib/workspace-controller-helpers";
import SignedWorkspaceBusBranch from "./SignedWorkspaceBusBranch.svelte";
import SignedWorkspaceCalendarBranch from "./SignedWorkspaceCalendarBranch.svelte";
import SignedWorkspaceLinksBranch from "./SignedWorkspaceLinksBranch.svelte";
import type { WorkspaceCalendarTabProps } from "./workspace-calendar-component-types";
import type { FormatMessage } from "./workspace-component-types";

export let addDays: WorkspaceCalendarTabProps["addDays"];
export let addMonths: WorkspaceCalendarTabProps["addMonths"];
export let busCopy: WorkspaceBusCopy;
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
export let copy: WorkspaceCalendarTabProps["copy"];
export let workspaceCopy: WorkspaceCalendarTabProps["workspaceCopy"];
export let workspaceTabHref: WorkspaceCalendarTabProps["workspaceTabHref"];
export let formatMessage: FormatMessage;
export let linkActionError: string;
export let linkIconLabel: (icon: string) => string;
export let linkReturnTo: string;
export let linkSearchInput: HTMLInputElement | null;
export let linkSearchQuery: string;
export let monthWeeks: WorkspaceCalendarTabProps["monthWeeks"];
export let sectionCopy: WorkspaceCalendarTabProps["sectionCopy"];
export let sessionHref: WorkspaceCalendarTabProps["sessionHref"];
export let setCalendarMonth: WorkspaceCalendarTabProps["setCalendarMonth"];
export let setCalendarSemester: WorkspaceCalendarTabProps["setCalendarSemester"];
export let setCalendarView: WorkspaceCalendarTabProps["setCalendarView"];
export let setCalendarWeek: WorkspaceCalendarTabProps["setCalendarWeek"];
export let signedData: WorkspaceCalendarTabProps["signedData"];
export let signedLinkGroups: SignedLinkGroup[];
export let submitWorkspaceLinkPin: WorkspaceLinkPinSubmit;
export let subscriptionsCopy: WorkspaceCalendarTabProps["subscriptionsCopy"];
export let updatingCatalogLinkSlug: string | null;
</script>

{#if signedData.tab === "links"}
  <SignedWorkspaceLinksBranch
    {workspaceCopy}
    {linkActionError}
    {linkIconLabel}
    {linkReturnTo}
    bind:linkSearchInput
    bind:linkSearchQuery
    {signedLinkGroups}
    {submitWorkspaceLinkPin}
    {updatingCatalogLinkSlug}
  />
{:else if signedData.tab === "bus"}
  <SignedWorkspaceBusBranch
    {busCopy}
    {signedData}
  />
{:else if signedData.tab === "calendar"}
  <SignedWorkspaceCalendarBranch
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
{/if}
