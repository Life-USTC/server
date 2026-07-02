<script lang="ts">
import CommentsPanel from "@/features/comments/components/CommentsPanel.svelte";
import DescriptionCard from "@/features/descriptions/components/DescriptionCard.svelte";
import type { SectionDetailPageData } from "@/features/section-detail/lib/section-detail-controller-helpers";
import DetailSectionNav from "$lib/components/DetailSectionNav.svelte";
import SectionBasicInfoCard from "./SectionBasicInfoCard.svelte";
import SectionCalendarTab from "./SectionCalendarTab.svelte";
import SectionExamSection from "./SectionExamSection.svelte";
import SectionHomeworkTab from "./SectionHomeworkTab.svelte";
import SectionTeachersCard from "./SectionTeachersCard.svelte";
import type {
  BooleanSetter,
  FormatMessage,
} from "./section-detail-component-types";
import type { SectionDetailMainContentProps } from "./section-detail-dialog-types";

export let calendarMonthLabel: string;
export let calendarMonthOffset: number;
export let canWriteHomework: boolean;
export let commentTargets: SectionDetailMainContentProps["commentTargets"];
export let commonCopy: SectionDetailMainContentProps["commonCopy"];
export let data: SectionDetailPageData;
export let fmtDate: SectionDetailMainContentProps["fmtDate"];
export let fmtDateTime: SectionDetailMainContentProps["fmtDateTime"];
export let formatMessage: FormatMessage;
export let homeworkCopy: SectionDetailMainContentProps["homeworkCopy"];
export let homeworkStatus: SectionDetailMainContentProps["homeworkStatus"];
export let homeworkView: SectionDetailMainContentProps["homeworkView"];
export let homeworks: SectionDetailMainContentProps["homeworks"];
export let notAvailable: string;
export let openCalendarDialog: SectionDetailMainContentProps["openCalendarDialog"];
export let openCreateHomeworkDialog: SectionDetailMainContentProps["openCreateHomeworkDialog"];
export let periodDetailRows: SectionDetailMainContentProps["periodDetailRows"];
export let primaryName: SectionDetailMainContentProps["primaryName"];
export let sectionCalendarEvents: SectionDetailMainContentProps["sectionCalendarEvents"];
export let sectionCalendarGridWeeks: SectionDetailMainContentProps["sectionCalendarGridWeeks"];
export let sectionCopy: SectionDetailMainContentProps["sectionCopy"];
export let sectionTeachersLabel: SectionDetailMainContentProps["sectionTeachersLabel"];
export let setHomeworkAuditDialogOpen: BooleanSetter;
export let setHomeworkView: SectionDetailMainContentProps["setHomeworkView"];
export let setSelectedHomework: SectionDetailMainContentProps["setSelectedHomework"];
export let teacherName: SectionDetailMainContentProps["teacherName"];
export let todayCalendarMonthOffset: number;
export let unscheduledCalendarEvents: SectionDetailMainContentProps["unscheduledCalendarEvents"];
export let viewer: SectionDetailMainContentProps["viewer"];
export let yesNo: SectionDetailMainContentProps["yesNo"];

$: sectionExamEvents = sectionCalendarEvents.filter(
  (event) => event.kind === "exam",
);
$: examSectionLabel = formatMessage(sectionCopy.exams, {
  count: String(sectionExamEvents.length),
});
$: commentsCount = data.commentsData
  ? Object.values(data.commentsData.commentMap).reduce(
      (sum, comments) => sum + comments.length,
      0,
    )
  : 0;
$: sectionNavItems = [
  { href: "#section-overview", label: sectionCopy.basicInfo },
  { href: "#section-description", label: data.copy.descriptions.title },
  {
    href: "#tab-calendar",
    label: sectionCopy.tabs.calendar,
    meta: sectionCalendarEvents.length,
  },
  { href: "#tab-exams", label: examSectionLabel },
  {
    href: "#tab-homework",
    label: sectionCopy.tabs.homeworks,
    meta: homeworks.length,
  },
  {
    href: "#section-teachers",
    label: sectionCopy.teachers,
    meta: data.section.teachers.length,
  },
  {
    href: "#tab-comments",
    label: sectionCopy.tabs.comments,
    meta: commentsCount,
  },
];
</script>

<div class="grid gap-5 lg:grid-cols-[12rem_minmax(0,1fr)] lg:items-start">
  <DetailSectionNav
    ariaLabel={sectionCopy.teachingSection}
    items={sectionNavItems}
  />

  <div class="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5">
    <section class="scroll-mt-20" id="section-overview">
      <SectionBasicInfoCard
        {commonCopy}
        {notAvailable}
        {periodDetailRows}
        {primaryName}
        section={data.section}
        {sectionCopy}
        {sectionTeachersLabel}
        {yesNo}
      />
    </section>

    <section class="scroll-mt-20" id="section-description">
      {#key `description:section:${data.section.id}`}
        <DescriptionCard
          targetType="section"
          targetId={data.section.id}
          initialData={data.descriptionData}
          locale={data.locale}
          copy={data.copy.descriptions}
        />
      {/key}
    </section>

    <section class="grid scroll-mt-20 gap-3" id="tab-calendar">
      <div>
        <h2 class="font-semibold text-lg">{sectionCopy.tabs.calendar}</h2>
        <p class="text-base-content/60 text-sm">{sectionCopy.calendarDescription}</p>
      </div>
      <SectionCalendarTab
        bind:calendarMonthOffset
        calendarGridWeeks={sectionCalendarGridWeeks}
        {calendarMonthLabel}
        dateTimePlaceText={data.section.dateTimePlaceText}
        {formatMessage}
        {openCalendarDialog}
        {sectionCalendarEvents}
        {sectionCopy}
        {todayCalendarMonthOffset}
        {unscheduledCalendarEvents}
      />
    </section>

    <section class="grid scroll-mt-20 gap-3" id="tab-exams">
      <div>
        <h2 class="font-semibold text-lg">{examSectionLabel}</h2>
      </div>
      <SectionExamSection
        events={sectionExamEvents}
        {fmtDate}
        {sectionCopy}
      />
    </section>

    <section class="grid scroll-mt-20 gap-3" id="tab-homework">
      <div>
        <h2 class="font-semibold text-lg">{sectionCopy.tabs.homeworks}</h2>
        <p class="text-base-content/60 text-sm">{sectionCopy.homeworkDescription}</p>
      </div>
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
    </section>

    <section class="scroll-mt-20" id="section-teachers">
      <SectionTeachersCard
        {primaryName}
        {sectionCopy}
        {teacherName}
        teachers={data.section.teachers}
      />
    </section>

    <section class="grid scroll-mt-20 gap-3" id="tab-comments">
      <div>
        <h2 class="font-semibold text-lg">{sectionCopy.tabs.comments}</h2>
      </div>
      {#key `comments:section:${data.section.id}`}
        <CommentsPanel
          initialData={data.commentsData}
          targetType="section"
          targetId={data.section.id}
          targets={commentTargets}
          showAllTargets
        />
      {/key}
    </section>
  </div>
</div>
