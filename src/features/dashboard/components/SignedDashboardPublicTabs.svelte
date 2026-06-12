<script lang="ts">
import type { DashboardBusCopy } from "@/features/dashboard/lib/bus-tab-types";
import type {
  DashboardLinkPinSubmit,
  LinkView,
  SignedLinkGroup,
} from "@/features/dashboard/lib/dashboard-controller-helpers";
import type { DashboardCalendarTabProps } from "./dashboard-calendar-component-types";
import type { FormatMessage } from "./dashboard-component-types";
import SignedDashboardBusBranch from "./SignedDashboardBusBranch.svelte";
import SignedDashboardCalendarBranch from "./SignedDashboardCalendarBranch.svelte";
import SignedDashboardLinksBranch from "./SignedDashboardLinksBranch.svelte";

export let addDays: DashboardCalendarTabProps["addDays"];
export let addMonths: DashboardCalendarTabProps["addMonths"];
export let busCopy: DashboardBusCopy;
export let calendarData: DashboardCalendarTabProps["calendarData"];
export let calendarEventParts: DashboardCalendarTabProps["calendarEventParts"];
export let calendarEventsForDay: DashboardCalendarTabProps["calendarEventsForDay"];
export let calendarExamDetail: DashboardCalendarTabProps["calendarExamDetail"];
export let calendarHomeworkDetail: DashboardCalendarTabProps["calendarHomeworkDetail"];
export let calendarHomeworkHref: DashboardCalendarTabProps["calendarHomeworkHref"];
export let calendarMonth: DashboardCalendarTabProps["calendarMonth"];
export let calendarSemesterId: DashboardCalendarTabProps["calendarSemesterId"];
export let calendarSemesterIndex: DashboardCalendarTabProps["calendarSemesterIndex"];
export let calendarSessionDetail: DashboardCalendarTabProps["calendarSessionDetail"];
export let calendarTodoDetail: DashboardCalendarTabProps["calendarTodoDetail"];
export let calendarView: DashboardCalendarTabProps["calendarView"];
export let calendarWeekLabel: DashboardCalendarTabProps["calendarWeekLabel"];
export let calendarWeekStart: DashboardCalendarTabProps["calendarWeekStart"];
export let calendarWeekdayLabels: DashboardCalendarTabProps["calendarWeekdayLabels"];
export let commonCopy: DashboardCalendarTabProps["commonCopy"];
export let copy: DashboardCalendarTabProps["copy"];
export let copyCalendarLink: DashboardCalendarTabProps["copyCalendarLink"];
export let dashboardCopy: DashboardCalendarTabProps["dashboardCopy"];
export let dashboardTabHref: DashboardCalendarTabProps["dashboardTabHref"];
export let formatMessage: FormatMessage;
export let linkActionError: string;
export let linkIconLabel: (icon: string) => string;
export let linkReturnTo: string;
export let linkSearchInput: HTMLInputElement | null;
export let linkSearchQuery: string;
export let linkView: LinkView;
export let monthWeeks: DashboardCalendarTabProps["monthWeeks"];
export let sectionCopy: DashboardCalendarTabProps["sectionCopy"];
export let sessionHref: DashboardCalendarTabProps["sessionHref"];
export let setCalendarMonth: DashboardCalendarTabProps["setCalendarMonth"];
export let setCalendarSemester: DashboardCalendarTabProps["setCalendarSemester"];
export let setCalendarView: DashboardCalendarTabProps["setCalendarView"];
export let setCalendarWeek: DashboardCalendarTabProps["setCalendarWeek"];
export let setLinkView: (view: LinkView) => void;
export let signedData: DashboardCalendarTabProps["signedData"];
export let signedLinkGroups: SignedLinkGroup[];
export let submitDashboardLinkPin: DashboardLinkPinSubmit;
export let subscriptionsCopy: DashboardCalendarTabProps["subscriptionsCopy"];
export let updatingDashboardLinkSlug: string | null;
</script>

{#if signedData.tab === "links"}
  <SignedDashboardLinksBranch
    {dashboardCopy}
    {linkActionError}
    {linkIconLabel}
    {linkReturnTo}
    bind:linkSearchInput
    bind:linkSearchQuery
    {linkView}
    {setLinkView}
    {signedLinkGroups}
    {submitDashboardLinkPin}
    {updatingDashboardLinkSlug}
  />
{:else if signedData.tab === "bus"}
  <SignedDashboardBusBranch
    {busCopy}
    {signedData}
  />
{:else if signedData.tab === "calendar"}
  <SignedDashboardCalendarBranch
    {copy}
    {commonCopy}
    {dashboardCopy}
    {sectionCopy}
    {subscriptionsCopy}
    {calendarWeekdayLabels}
    {signedData}
    {dashboardTabHref}
    {formatMessage}
    {copyCalendarLink}
    {sessionHref}
    {setCalendarView}
    {setCalendarMonth}
    {setCalendarWeek}
    {setCalendarSemester}
    {addDays}
    {addMonths}
    {monthWeeks}
    {calendarEventsForDay}
    {calendarWeekLabel}
    {calendarEventParts}
    {calendarHomeworkHref}
    {calendarSessionDetail}
    {calendarExamDetail}
    {calendarHomeworkDetail}
    {calendarTodoDetail}
    {calendarSemesterIndex}
    {calendarView}
    {calendarMonth}
    {calendarWeekStart}
    {calendarSemesterId}
    {calendarData}
  />
{/if}
