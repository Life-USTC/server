<script lang="ts">
import CommentsPanel from "@/features/comments/components/CommentsPanel.svelte";
import DescriptionCard from "@/features/descriptions/components/DescriptionCard.svelte";
import type { SectionDetailPageData } from "@/features/section-detail/lib/section-detail-controller-helpers";
import * as Tabs from "$lib/components/ui/tabs/index.js";
import SectionCalendarTab from "./SectionCalendarTab.svelte";
import SectionDetailSidebar from "./SectionDetailSidebar.svelte";
import SectionHomeworkTab from "./SectionHomeworkTab.svelte";
import type {
  BooleanSetter,
  FormatMessage,
  IsSameMonth,
} from "./section-detail-component-types";
import type { SectionDetailMainContentProps } from "./section-detail-dialog-types";

export let activeTab: SectionDetailMainContentProps["activeTab"];
export let calendarExamDateKeys: SectionDetailMainContentProps["calendarExamDateKeys"];
export let calendarMonthDays: SectionDetailMainContentProps["calendarMonthDays"];
export let calendarMonthLabel: string;
export let calendarMonthOffset: number;
export let calendarScheduleDateKeys: SectionDetailMainContentProps["calendarScheduleDateKeys"];
export let commentTargets: SectionDetailMainContentProps["commentTargets"];
export let commonCopy: SectionDetailMainContentProps["commonCopy"];
export let canWriteHomework: boolean;
export let data: SectionDetailPageData;
export let dateKey: SectionDetailMainContentProps["dateKey"];
export let fmtDate: SectionDetailMainContentProps["fmtDate"];
export let fmtDateTime: SectionDetailMainContentProps["fmtDateTime"];
export let formatMessage: FormatMessage;
export let homeworkCopy: SectionDetailMainContentProps["homeworkCopy"];
export let homeworkStatus: SectionDetailMainContentProps["homeworkStatus"];
export let homeworkView: SectionDetailMainContentProps["homeworkView"];
export let homeworks: SectionDetailMainContentProps["homeworks"];
export let isSameMonth: IsSameMonth;
export let notAvailable: string;
export let openCalendarDialog: SectionDetailMainContentProps["openCalendarDialog"];
export let openCreateHomeworkDialog: SectionDetailMainContentProps["openCreateHomeworkDialog"];
export let periodDetailRows: SectionDetailMainContentProps["periodDetailRows"];
export let primaryName: SectionDetailMainContentProps["primaryName"];
export let sectionCalendarEvents: SectionDetailMainContentProps["sectionCalendarEvents"];
export let sectionCalendarGridWeeks: SectionDetailMainContentProps["sectionCalendarGridWeeks"];
export let sectionCopy: SectionDetailMainContentProps["sectionCopy"];
export let sectionTeachersLabel: SectionDetailMainContentProps["sectionTeachersLabel"];
export let setActiveTab: SectionDetailMainContentProps["setActiveTab"];
export let setHomeworkAuditDialogOpen: BooleanSetter;
export let setHomeworkView: SectionDetailMainContentProps["setHomeworkView"];
export let setSelectedHomework: SectionDetailMainContentProps["setSelectedHomework"];
export let tabs: SectionDetailMainContentProps["tabs"];
export let teacherName: SectionDetailMainContentProps["teacherName"];
export let todayCalendarKey: SectionDetailMainContentProps["todayCalendarKey"];
export let unscheduledCalendarEvents: SectionDetailMainContentProps["unscheduledCalendarEvents"];
export let viewer: SectionDetailMainContentProps["viewer"];
export let visibleCalendarMonth: Date;
export let yesNo: SectionDetailMainContentProps["yesNo"];
</script>

<div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
  <div class="grid min-w-0 gap-5">
    <DescriptionCard
      targetType="section"
      targetId={data.section.id}
      initialData={data.descriptionData}
      locale={data.locale}
      copy={data.copy.descriptions}
    />

    <Tabs.Root aria-label={sectionCopy.teachingSection}>
      <Tabs.List>
        {#each tabs as [id, label]}
          <Tabs.Button selected={activeTab === id} onclick={() => setActiveTab(id)}>
            {label}
          </Tabs.Button>
        {/each}
      </Tabs.List>
    </Tabs.Root>

    {#if activeTab === "calendar"}
      <SectionCalendarTab
        bind:calendarMonthOffset
        calendarGridWeeks={sectionCalendarGridWeeks()}
        {calendarMonthLabel}
        dateTimePlaceText={data.section.dateTimePlaceText}
        {fmtDate}
        {formatMessage}
        {openCalendarDialog}
        {sectionCalendarEvents}
        {sectionCopy}
        {unscheduledCalendarEvents}
      />
    {:else if activeTab === "homework"}
      <SectionHomeworkTab
        {canWriteHomework}
        {fmtDateTime}
        {homeworkCopy}
        {homeworkStatus}
        {homeworkView}
        {homeworks}
        isAuthenticated={viewer.isAuthenticated ?? viewer.signedIn === true}
        openAuditDialog={() => setHomeworkAuditDialogOpen(true)}
        {openCreateHomeworkDialog}
        {sectionCopy}
        sectionJwId={data.section.jwId}
        selectHomework={setSelectedHomework}
        {setHomeworkView}
      />
    {:else if activeTab === "comments"}
      <section class="grid gap-3">
        <CommentsPanel
          initialData={data.commentsData}
          targetType="section"
          targetId={data.section.id}
          targets={commentTargets}
          showAllTargets
        />
      </section>
    {/if}
  </div>

  <SectionDetailSidebar
    {calendarExamDateKeys}
    {calendarMonthDays}
    {calendarMonthLabel}
    {calendarScheduleDateKeys}
    {commonCopy}
    {dateKey}
    {isSameMonth}
    {notAvailable}
    {periodDetailRows}
    {primaryName}
    section={data.section}
    {sectionCopy}
    {sectionTeachersLabel}
    {teacherName}
    {todayCalendarKey}
    {visibleCalendarMonth}
    {yesNo}
  />
</div>
