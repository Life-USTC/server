<script lang="ts">
import BookOpenTextIcon from "@lucide/svelte/icons/book-open-text";
import CalendarDaysIcon from "@lucide/svelte/icons/calendar-days";
import ClipboardListIcon from "@lucide/svelte/icons/clipboard-list";
import GraduationCapIcon from "@lucide/svelte/icons/graduation-cap";
import InfoIcon from "@lucide/svelte/icons/info";
import MessageSquareIcon from "@lucide/svelte/icons/message-square";
import UsersIcon from "@lucide/svelte/icons/users";
import type { SubmitFunction } from "@sveltejs/kit";
import type { SectionDetailPageData } from "@/features/section-detail/lib/section-detail-controller-helpers";
import type { SectionDetailSection } from "@/features/section-detail/lib/section-detail-controller-types";
import {
  type SectionDetailTab,
  sectionDetailPagePath,
} from "@/features/section-detail/lib/section-detail-tab";
import DetailSectionNav from "$lib/components/DetailSectionNav.svelte";
import * as Alert from "$lib/components/ui/alert/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import { Separator } from "$lib/components/ui/separator/index.js";
import { cn } from "$lib/utils.js";
import SectionBasicInfoCard from "./SectionBasicInfoCard.svelte";
import SectionDetailHeader from "./SectionDetailHeader.svelte";
import SectionDetailPrimaryActions from "./SectionDetailPrimaryActions.svelte";
import SectionTeachersCard from "./SectionTeachersCard.svelte";
import type {
  BooleanSetter,
  FormatMessage,
} from "./section-detail-component-types";
import type { SectionDetailMainContentProps } from "./section-detail-dialog-types";

type SubscriptionActionKey = "subscribe" | "unsubscribe";

export let activeTab: SectionDetailTab;
export let calendarMonthLabel: string;
export let calendarMonthOffset: number;
export let canWriteHomework: boolean;
export let commentTargets: SectionDetailMainContentProps["commentTargets"];
export let commonCopy: SectionDetailMainContentProps["commonCopy"];
export let courseName: string;
export let courseSecondaryName: string;
export let data: SectionDetailPageData;
export let displaySection: SectionDetailSection;
export let descriptionData: SectionDetailPageData["descriptionData"];
export let formError: string | null | undefined;
export let fmtDate: SectionDetailMainContentProps["fmtDate"];
export let fmtDateTime: SectionDetailMainContentProps["fmtDateTime"];
export let formatMessage: FormatMessage;
export let homeworkCopy: SectionDetailMainContentProps["homeworkCopy"];
export let homeworkStatus: SectionDetailMainContentProps["homeworkStatus"];
export let homeworkView: SectionDetailMainContentProps["homeworkView"];
export let homeworks: SectionDetailMainContentProps["homeworks"];
export let notAvailable: string;
export let onSelectTab: (tab: SectionDetailTab) => void;
export let openCalendarDialog: SectionDetailMainContentProps["openCalendarDialog"];
export let openCreateHomeworkDialog: SectionDetailMainContentProps["openCreateHomeworkDialog"];
export let openSubscribeDialog: () => void;
export let periodDetailRows: SectionDetailMainContentProps["periodDetailRows"];
export let primaryName: SectionDetailMainContentProps["primaryName"];
export let sectionCalendarEvents: SectionDetailMainContentProps["sectionCalendarEvents"];
export let sectionCalendarGridWeeks: SectionDetailMainContentProps["sectionCalendarGridWeeks"];
export let sectionCopy: SectionDetailMainContentProps["sectionCopy"];
export let sectionTeachersLabel: SectionDetailMainContentProps["sectionTeachersLabel"];
export let setHomeworkAuditDialogOpen: BooleanSetter;
export let setHomeworkView: SectionDetailMainContentProps["setHomeworkView"];
export let setSelectedHomework: SectionDetailMainContentProps["setSelectedHomework"];
export let subscriptionAction: (
  action: SubscriptionActionKey,
) => SubmitFunction;
export let subscriptionPendingAction: SubscriptionActionKey | null;
export let tabPanelLoading: boolean;
export let teacherName: SectionDetailMainContentProps["teacherName"];
export let todayCalendarMonthOffset: number;
export let unscheduledCalendarEvents: SectionDetailMainContentProps["unscheduledCalendarEvents"];
export let viewer: SectionDetailMainContentProps["viewer"];
export let yesNo: SectionDetailMainContentProps["yesNo"];

let DescriptionCard:
  | typeof import("@/features/descriptions/components/DescriptionCard.svelte").default
  | null = null;
let CommentsPanel:
  | typeof import("@/features/comments/components/CommentsPanel.svelte").default
  | null = null;
let SectionCalendarTab:
  | typeof import("./SectionCalendarTab.svelte").default
  | null = null;
let SectionExamSection:
  | typeof import("./SectionExamSection.svelte").default
  | null = null;
let SectionHomeworkTab:
  | typeof import("./SectionHomeworkTab.svelte").default
  | null = null;

async function ensureDescriptionCard() {
  DescriptionCard ??= (
    await import("@/features/descriptions/components/DescriptionCard.svelte")
  ).default;
}

async function ensureCommentsPanel() {
  CommentsPanel ??= (
    await import("@/features/comments/components/CommentsPanel.svelte")
  ).default;
}

async function ensureSectionCalendarTab() {
  SectionCalendarTab ??= (await import("./SectionCalendarTab.svelte")).default;
}

async function ensureSectionExamSection() {
  SectionExamSection ??= (await import("./SectionExamSection.svelte")).default;
}

async function ensureSectionHomeworkTab() {
  SectionHomeworkTab ??= (await import("./SectionHomeworkTab.svelte")).default;
}

$: if (activeTab === "introduction") {
  void ensureDescriptionCard();
}
$: if (activeTab === "comments") {
  void ensureCommentsPanel();
}
$: if (activeTab === "calendar") {
  void ensureSectionCalendarTab();
}
$: if (activeTab === "exams") {
  void ensureSectionExamSection();
}
$: if (activeTab === "homework") {
  void ensureSectionHomeworkTab();
}

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
  : undefined;
$: sectionNavItems = [
  {
    href: sectionDetailPagePath(data.section.jwId, "overview"),
    icon: InfoIcon,
    key: "overview" as const,
    label: sectionCopy.basicInfo,
  },
  {
    href: sectionDetailPagePath(data.section.jwId, "introduction"),
    icon: BookOpenTextIcon,
    key: "introduction" as const,
    label: data.copy.descriptions.title,
  },
  {
    href: sectionDetailPagePath(data.section.jwId, "calendar"),
    icon: CalendarDaysIcon,
    key: "calendar" as const,
    label: sectionCopy.tabs.calendar,
    meta: displaySection.scheduleCount + displaySection.examCount,
  },
  {
    href: sectionDetailPagePath(data.section.jwId, "exams"),
    icon: GraduationCapIcon,
    key: "exams" as const,
    label: sectionCopy.tabs.exams,
    meta: displaySection.examCount,
  },
  {
    href: sectionDetailPagePath(data.section.jwId, "homework"),
    icon: ClipboardListIcon,
    key: "homework" as const,
    label: sectionCopy.tabs.homeworks,
    meta: activeTab === "homework" ? homeworks.length : undefined,
  },
  {
    href: sectionDetailPagePath(data.section.jwId, "teachers"),
    icon: UsersIcon,
    key: "teachers" as const,
    label: sectionCopy.teachers,
    meta: displaySection.teachers.length,
  },
  {
    href: sectionDetailPagePath(data.section.jwId, "comments"),
    icon: MessageSquareIcon,
    key: "comments" as const,
    label: sectionCopy.tabs.comments,
    meta: commentsCount,
  },
];
</script>

<div class="grid min-h-full grid-rows-[auto_minmax(0,1fr)_auto] bg-card lg:h-full lg:min-h-0 lg:grid-rows-[auto_minmax(0,1fr)]">
  <div class="bg-card px-4 sm:px-5 lg:px-6" data-testid="detail-pinned-summary">
    <SectionDetailHeader
      courseName={courseName}
      courseSecondaryName={courseSecondaryName}
      formError={formError}
      notAvailable={notAvailable}
      onOpenCalendar={openCalendarDialog}
      onOpenSubscribe={openSubscribeDialog}
      primaryName={primaryName}
      section={data.section}
      sectionCopy={sectionCopy}
      subscriptionAction={subscriptionAction}
      subscriptionPendingAction={subscriptionPendingAction}
      viewer={data.viewer}
    />
  </div>

  <div class="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] bg-card lg:grid-cols-[auto_minmax(0,1fr)] lg:grid-rows-none">
    <DetailSectionNav
      activeKey={activeTab}
      ariaLabel={sectionCopy.teachingSection}
      items={sectionNavItems}
      label={sectionCopy.teachingSection}
      onSelect={(key) => onSelectTab(key as SectionDetailTab)}
    />

    <div
      class="min-w-0 min-h-0 overflow-y-auto px-4 py-4 sm:px-5 lg:px-6"
      aria-busy={tabPanelLoading}
      data-detail-scroll-container
    >
      {#if tabPanelLoading}
        <p class="sr-only">
          {data.locale === "zh-cn" ? "加载中..." : "Loading..."}
        </p>
      {/if}
      {#if activeTab === "overview"}
      <section id="section-overview">
        <SectionBasicInfoCard
          {commonCopy}
          {notAvailable}
          {periodDetailRows}
          {primaryName}
          section={displaySection}
          {sectionCopy}
          {sectionTeachersLabel}
          {yesNo}
        />
      </section>
      {:else if activeTab === "introduction"}
      <section id="section-description">
        {#key `description:section:${data.section.id}`}
          {#if DescriptionCard}
            <svelte:component
              this={DescriptionCard}
              targetType="section"
              targetId={data.section.id}
              initialData={descriptionData}
              locale={data.locale}
              copy={data.copy.descriptions}
              showTitle={false}
            />
          {:else if descriptionData.description.renderedHtml}
            <div class="markdown-preview" data-slot="markdown-preview">
              {@html descriptionData.description.renderedHtml}
            </div>
          {/if}
        {/key}
      </section>
      {:else if activeTab === "calendar"}
      <section id="tab-calendar">
        {#if SectionCalendarTab}
          <svelte:component
            this={SectionCalendarTab}
            bind:calendarMonthOffset
            calendarGridWeeks={sectionCalendarGridWeeks}
            {calendarMonthLabel}
            dateTimePlaceText={displaySection.dateTimePlaceText}
            {formatMessage}
            {openCalendarDialog}
            {sectionCalendarEvents}
            {sectionCopy}
            {todayCalendarMonthOffset}
            {unscheduledCalendarEvents}
          />
        {/if}
      </section>
      {:else if activeTab === "exams"}
      <section id="tab-exams">
        {#if SectionExamSection}
          <svelte:component
            this={SectionExamSection}
            events={sectionExamEvents}
            {fmtDate}
            {sectionCopy}
          />
        {/if}
      </section>
      {:else if activeTab === "homework"}
      <section id="tab-homework">
        {#if SectionHomeworkTab}
          <svelte:component
            this={SectionHomeworkTab}
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
        {/if}
      </section>
      {:else if activeTab === "teachers"}
      <section id="section-teachers">
        <SectionTeachersCard
          {primaryName}
          {sectionCopy}
          {teacherName}
          teachers={displaySection.teachers}
        />
      </section>
      {:else if activeTab === "comments"}
      <section id="tab-comments">
        {#key `comments:section:${data.section.id}`}
          {#if CommentsPanel}
            <svelte:component
              this={CommentsPanel}
              initialData={data.commentsData}
              targetType="section"
              targetId={data.section.id}
              targets={commentTargets}
              showAllTargets
            />
          {/if}
        {/key}
      </section>
      {/if}
    </div>
  </div>

  <div
    class={cn(
      "sticky bottom-0 z-10 bg-background md:hidden",
      viewer.signedIn &&
        "bottom-[calc(3.5rem+env(safe-area-inset-bottom))]",
    )}
    data-testid="section-mobile-primary-actions"
  >
    <Separator />
    <div class="p-3">
      <SectionDetailPrimaryActions
        onOpenCalendar={openCalendarDialog}
        onOpenSubscribe={openSubscribeDialog}
        retired={data.section.retiredAt != null}
        {sectionCopy}
        stretched
        {subscriptionAction}
        {subscriptionPendingAction}
        viewer={data.viewer}
      />
    </div>
  </div>
</div>
