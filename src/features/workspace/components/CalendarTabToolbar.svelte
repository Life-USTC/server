<script lang="ts">
import MoreHorizontal from "@lucide/svelte/icons/more-horizontal";
import { Button } from "#lib/components/ui/button/index.js";
import * as DropdownMenu from "#lib/components/ui/dropdown-menu/index.js";
import * as ToggleGroup from "#lib/components/ui/toggle-group/index.js";
import CalendarTabNavigationControls from "./CalendarTabNavigationControls.svelte";
import PersonalCalendarLinkButton from "./PersonalCalendarLinkButton.svelte";
import type { WorkspaceCalendarTabProps } from "./workspace-calendar-component-types";
import type { FormatMessage } from "./workspace-component-types";

export let addDays: WorkspaceCalendarTabProps["addDays"];
export let addMonths: WorkspaceCalendarTabProps["addMonths"];
export let calendarData: WorkspaceCalendarTabProps["calendarData"];
export let agendaWeekStart: string;
export let calendarDay: WorkspaceCalendarTabProps["calendarDay"];
export let calendarMonth: WorkspaceCalendarTabProps["calendarMonth"];
export let calendarSemesterIndex: WorkspaceCalendarTabProps["calendarSemesterIndex"];
export let calendarView: WorkspaceCalendarTabProps["calendarView"];
export let calendarWeekStart: WorkspaceCalendarTabProps["calendarWeekStart"];
export let commonCopy: WorkspaceCalendarTabProps["commonCopy"];
export let workspaceCopy: WorkspaceCalendarTabProps["workspaceCopy"];
export let formatMessage: FormatMessage;
export let sectionCopy: WorkspaceCalendarTabProps["sectionCopy"];
export let setCalendarDay: WorkspaceCalendarTabProps["setCalendarDay"];
export let setCalendarMonth: WorkspaceCalendarTabProps["setCalendarMonth"];
export let setCalendarSemester: WorkspaceCalendarTabProps["setCalendarSemester"];
export let setCalendarView: WorkspaceCalendarTabProps["setCalendarView"];
export let setCalendarWeek: WorkspaceCalendarTabProps["setCalendarWeek"];
export let signedData: WorkspaceCalendarTabProps["signedData"];
export let subscriptionsCopy: WorkspaceCalendarTabProps["subscriptionsCopy"];
export let activitiesManageLabel: string;
const activitiesManageHref = "/workspace/subscriptions/activities";

let personalCalendarLink: PersonalCalendarLinkButton | undefined;
</script>

<div class="grid min-w-0 gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start" data-testid="workspace-calendar-mobile-toolbar">
  <div class="grid min-w-0 gap-2">
    <ToggleGroup.Root
      aria-label={workspaceCopy.calendarViewLabel}
      class="w-full sm:w-fit"
      type="single"
      required
      value={calendarView}
      variant="outline"
      onValueChange={(value) => {
        if (value === "semester" || value === "month" || value === "week" || value === "day") setCalendarView(value);
      }}
    >
      <ToggleGroup.Item class="h-11 flex-1" value="day">{workspaceCopy.calendarViewDay}</ToggleGroup.Item>
      <ToggleGroup.Item class="h-11 flex-1" value="week">{workspaceCopy.calendarViewWeek}</ToggleGroup.Item>
      <ToggleGroup.Item class="h-11 flex-1" value="month">{workspaceCopy.calendarViewMonth}</ToggleGroup.Item>
      <ToggleGroup.Item class="h-11 flex-1" value="semester">{workspaceCopy.calendarViewSemester}</ToggleGroup.Item>
    </ToggleGroup.Root>
    <div class="flex min-w-0 items-start justify-between gap-2">
      <CalendarTabNavigationControls
        {addDays} {addMonths} {calendarData} {calendarDay} {calendarMonth}
        {calendarSemesterIndex} {calendarView}
        calendarWeekStart={calendarWeekStart || agendaWeekStart}
        {commonCopy} {workspaceCopy} {formatMessage} {sectionCopy}
        {setCalendarDay} {setCalendarMonth} {setCalendarSemester} {setCalendarWeek}
      />
      <div class="xl:hidden">
      <DropdownMenu.Root>
        <DropdownMenu.Trigger>
          {#snippet child({ props })}
            <Button
              {...props}
              aria-label={workspaceCopy.calendarMoreActions}
              class="size-11"
              size="icon"
              type="button"
              variant="outline"
            >
              <MoreHorizontal data-icon="inline-start" />
            </Button>
          {/snippet}
        </DropdownMenu.Trigger>
        <DropdownMenu.Content align="end" preventScroll={false}>
          <DropdownMenu.Group>
            <DropdownMenu.Item disabled={Boolean(signedData.demo)}>
              {#snippet child({ props })}
                {#if signedData.demo}<span {...props} title={signedData.demo.readOnlyReason}>{activitiesManageLabel}</span>
                {:else}<a {...props} href={activitiesManageHref}>{activitiesManageLabel}</a>{/if}
              {/snippet}
            </DropdownMenu.Item>
            {#if signedData.calendarLinkState || signedData.calendarSubscriptionUrl}
              <DropdownMenu.Item onSelect={() => personalCalendarLink?.open()}>
                {subscriptionsCopy.iCalLink}
              </DropdownMenu.Item>
            {/if}
          </DropdownMenu.Group>
        </DropdownMenu.Content>
      </DropdownMenu.Root>
      </div>
    </div>
  </div>
  <div class="hidden flex-wrap items-center gap-2 xl:flex xl:justify-end">
    <Button class="min-w-28 md:min-w-28" href={signedData.demo ? undefined : activitiesManageHref} disabled={Boolean(signedData.demo)} title={signedData.demo?.readOnlyReason} variant="outline">
      {activitiesManageLabel}
    </Button>
    {#if signedData.calendarLinkState || signedData.calendarSubscriptionUrl}
      <PersonalCalendarLinkButton
        bind:this={personalCalendarLink}
        buttonLabel={subscriptionsCopy.iCalLink}
        className="min-w-28 md:min-w-28"
        failureMessage={subscriptionsCopy.optOutRetry}
        {sectionCopy}
        showSubscriptionsLink={true}
        subscriptionCalendarUrl={signedData.calendarSubscriptionUrl ?? ""}
        calendarLinkState={signedData.calendarLinkState}
      />
    {/if}
  </div>
</div>
