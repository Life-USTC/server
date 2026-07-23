<script lang="ts">
import BookOpenTextIcon from "@lucide/svelte/icons/book-open-text";
import CalendarDaysIcon from "@lucide/svelte/icons/calendar-days";
import ClipboardListIcon from "@lucide/svelte/icons/clipboard-list";
import GraduationCapIcon from "@lucide/svelte/icons/graduation-cap";
import InfoIcon from "@lucide/svelte/icons/info";
import MessageSquareIcon from "@lucide/svelte/icons/message-square";
import UsersIcon from "@lucide/svelte/icons/users";
import type { SubmitFunction } from "@sveltejs/kit";
import CommentsPanel from "@/features/comments/components/CommentsPanel.svelte";
import DescriptionCard from "@/features/descriptions/components/DescriptionCard.svelte";
import type { SectionDetailPageData } from "@/features/section-detail/lib/section-detail-controller-helpers";
import DetailSectionNav from "$lib/components/DetailSectionNav.svelte";
import * as Alert from "$lib/components/ui/alert/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import { Separator } from "$lib/components/ui/separator/index.js";
import { cn } from "$lib/utils.js";
import SectionBasicInfoCard from "./SectionBasicInfoCard.svelte";
import SectionCalendarTab from "./SectionCalendarTab.svelte";
import SectionDetailHeader from "./SectionDetailHeader.svelte";
import SectionDetailPrimaryActions from "./SectionDetailPrimaryActions.svelte";
import SectionExamSection from "./SectionExamSection.svelte";
import SectionHomeworkTab from "./SectionHomeworkTab.svelte";
import SectionTeachersCard from "./SectionTeachersCard.svelte";
import type {
  BooleanSetter,
  FormatMessage,
} from "./section-detail-component-types";
import type { SectionDetailMainContentProps } from "./section-detail-dialog-types";

type SubscriptionActionKey = "subscribe" | "unsubscribe";

export let calendarMonthLabel: string;
export let calendarMonthOffset: number;
export let canWriteHomework: boolean;
export let commentTargets: SectionDetailMainContentProps["commentTargets"];
export let commonCopy: SectionDetailMainContentProps["commonCopy"];
export let courseName: string;
export let courseSecondaryName: string;
export let data: SectionDetailPageData;
export let formError: string | null | undefined;
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
$: sectionBaseHref = `/catalog/sections/${data.section.jwId}`;
$: sectionNavItems = [
  {
    href: sectionBaseHref,
    icon: InfoIcon,
    key: "overview" as const,
    label: sectionCopy.basicInfo,
  },
  {
    href: `${sectionBaseHref}/introduction`,
    icon: BookOpenTextIcon,
    key: "introduction" as const,
    label: data.copy.descriptions.title,
  },
  {
    href: `${sectionBaseHref}/calendar`,
    icon: CalendarDaysIcon,
    key: "calendar" as const,
    label: sectionCopy.tabs.calendar,
    meta: sectionCalendarEvents.length,
  },
  {
    href: `${sectionBaseHref}/exams`,
    icon: GraduationCapIcon,
    key: "exams" as const,
    label: sectionCopy.tabs.exams,
    meta: sectionExamEvents.length,
  },
  {
    href: `${sectionBaseHref}/homework`,
    icon: ClipboardListIcon,
    key: "homework" as const,
    label: sectionCopy.tabs.homeworks,
    meta: data.detailSection === "homework" ? homeworks.length : undefined,
  },
  {
    href: `${sectionBaseHref}/teachers`,
    icon: UsersIcon,
    key: "teachers" as const,
    label: sectionCopy.teachers,
    meta: data.section.teachers.length,
  },
  {
    href: `${sectionBaseHref}/comments`,
    icon: MessageSquareIcon,
    key: "comments" as const,
    label: sectionCopy.tabs.comments,
    meta: data.commentsData ? commentsCount : undefined,
  },
];
$: activeNavItem =
  sectionNavItems.find((item) => item.key === data.detailSection) ??
  sectionNavItems[0];
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
      activeHref={activeNavItem?.href ?? sectionBaseHref}
      ariaLabel={sectionCopy.teachingSection}
      items={sectionNavItems}
      label={sectionCopy.teachingSection}
    />

    <div
      class="min-w-0 min-h-0 overflow-y-auto px-4 py-4 sm:px-5 lg:px-6"
      data-detail-scroll-container
    >
      {#if data.detailSection === "overview"}
      <section id="section-overview">
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
      {:else if data.detailSection === "introduction"}
      <section id="section-description">
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
      {:else if data.detailSection === "calendar"}
      <section id="tab-calendar">
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
      {:else if data.detailSection === "exams"}
      <section id="tab-exams">
        <SectionExamSection
          events={sectionExamEvents}
          {fmtDate}
          {sectionCopy}
        />
      </section>
      {:else if data.detailSection === "homework"}
      <section id="tab-homework">
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
      {:else if data.detailSection === "teachers"}
      <section id="section-teachers">
        <SectionTeachersCard
          {primaryName}
          {sectionCopy}
          {teacherName}
          teachers={data.section.teachers}
        />
      </section>
      {:else if data.detailSection === "comments"}
      <section id="tab-comments">
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
