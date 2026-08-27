<script lang="ts">
import CalendarIcon from "@lucide/svelte/icons/calendar";
import type { SubmitFunction } from "@sveltejs/kit";
import { onMount } from "svelte";
import type { SectionDetailPageData } from "@/features/section-detail/lib/section-detail-controller-helpers";
import type { SectionDetailSection } from "@/features/section-detail/lib/section-detail-controller-types";
import * as Alert from "$lib/components/ui/alert/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import { Separator } from "$lib/components/ui/separator/index.js";
import { Spinner } from "$lib/components/ui/spinner/index.js";
import { cn } from "$lib/utils.js";
import SectionBasicInfoCard from "./SectionBasicInfoCard.svelte";
import SectionDetailHeader from "./SectionDetailHeader.svelte";
import SectionDetailPrimaryActions from "./SectionDetailPrimaryActions.svelte";
import type { SectionDetailMainContentProps } from "./section-detail-dialog-types";

type SubscriptionActionKey = "subscribe" | "unsubscribe";

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
export let homeworkCopy: SectionDetailMainContentProps["homeworkCopy"];
export let homeworks: SectionDetailMainContentProps["homeworks"];
export let notAvailable: string;
export let openCalendarDialog: SectionDetailMainContentProps["openCalendarDialog"];
export let openCreateHomeworkDialog: SectionDetailMainContentProps["openCreateHomeworkDialog"];
export let openSubscribeDialog: () => void;
export let periodDetailRows: SectionDetailMainContentProps["periodDetailRows"];
export let primaryName: SectionDetailMainContentProps["primaryName"];
export let sectionCalendarEvents: SectionDetailMainContentProps["sectionCalendarEvents"];
export let sectionCopy: SectionDetailMainContentProps["sectionCopy"];
export let sectionTeachersLabel: SectionDetailMainContentProps["sectionTeachersLabel"];
export let setSelectedHomework: SectionDetailMainContentProps["setSelectedHomework"];
export let retryStreamPanels: () => void;
export let streamError: string | null;
export let streamLoading: boolean;
export let subscriptionAction: (
  action: SubscriptionActionKey,
) => SubmitFunction;
export let subscriptionPendingAction: SubscriptionActionKey | null;
export let teacherName: SectionDetailMainContentProps["teacherName"];
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

onMount(() => {
  void (async () => {
    DescriptionCard ??= (
      await import("@/features/descriptions/components/DescriptionCard.svelte")
    ).default;
    SectionCalendarTab ??= (await import("./SectionCalendarTab.svelte"))
      .default;
    SectionExamSection ??= (await import("./SectionExamSection.svelte"))
      .default;
    SectionHomeworkTab ??= (await import("./SectionHomeworkTab.svelte"))
      .default;
    CommentsPanel ??= (
      await import("@/features/comments/components/CommentsPanel.svelte")
    ).default;
  })();
});

$: sectionExamEvents = sectionCalendarEvents.filter(
  (event) => event.kind === "exam",
);
</script>

<div class="grid min-h-full grid-rows-[auto_minmax(0,1fr)_auto] bg-card lg:h-full lg:min-h-0 lg:grid-rows-[auto_minmax(0,1fr)]">
  <div class="bg-card px-4 sm:px-5 lg:px-6" data-testid="detail-pinned-summary">
    <SectionDetailHeader
      courseName={courseName}
      courseSecondaryName={courseSecondaryName}
      formError={formError}
      onOpenCalendar={openCalendarDialog}
      onOpenSubscribe={openSubscribeDialog}
      section={displaySection}
      sectionCopy={sectionCopy}
      subscriptionAction={subscriptionAction}
      subscriptionPendingAction={subscriptionPendingAction}
      viewer={data.viewer}
    />
  </div>

  <div
    class={cn(
      "min-w-0 min-h-0 overflow-y-auto px-4 pt-4 sm:px-5 lg:px-6 md:pb-4",
      viewer.signedIn
        ? "pb-[calc(9rem+max(0.75rem,env(safe-area-inset-bottom)))]"
        : "pb-[calc(5rem+max(0.75rem,env(safe-area-inset-bottom)))]",
    )}
    aria-busy={streamLoading}
    data-detail-scroll-container
  >
    {#if streamLoading}
      <div
        class="text-muted-foreground flex items-center justify-center gap-2 px-2 py-6 text-sm"
        role="status"
      >
        <Spinner class="size-4 shrink-0" />
        <span>{data.locale === "zh-cn" ? "加载中..." : "Loading..."}</span>
      </div>
    {/if}

    {#if streamError}
      <Alert.Root class="mb-6" role="alert" variant="destructive">
        <Alert.Title>{streamError}</Alert.Title>
        <Alert.Description class="flex flex-wrap items-center gap-3">
          <span>{sectionCopy.pleaseRetry}</span>
          <Button
            size="sm"
            type="button"
            variant="outline"
            onclick={retryStreamPanels}
          >
            {sectionCopy.pleaseRetry}
          </Button>
        </Alert.Description>
      </Alert.Root>
    {/if}

    <div class="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,20rem)] lg:items-start lg:gap-10">
      <div class="grid min-w-0 gap-10">
        <section id="introduction" class="scroll-mt-4">
          {#key `description:section:${data.section.id}`}
            {#if DescriptionCard}
              <svelte:component
                this={DescriptionCard}
                targetType="section"
                targetId={data.section.id}
                initialData={descriptionData}
                locale={data.locale}
                copy={data.copy.descriptions}
                heading={data.copy.descriptions.title}
                showTitle={false}
              />
            {:else if descriptionData.description.renderedHtml}
              <h2 class="mb-3 text-lg font-semibold tracking-tight">
                {data.copy.descriptions.title}
              </h2>
              <div class="markdown-preview" data-slot="markdown-preview">
                {@html descriptionData.description.renderedHtml}
              </div>
            {/if}
          {/key}
        </section>

        <section id="calendar" class="scroll-mt-4">
          <div class="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 class="text-lg font-semibold tracking-tight">
              {sectionCopy.tabs.calendar}
            </h2>
            <Button variant="outline" type="button" onclick={openCalendarDialog}>
              <CalendarIcon data-icon="inline-start" />
              {sectionCopy.addToCalendar}
            </Button>
          </div>
          {#if SectionCalendarTab}
            <svelte:component
              this={SectionCalendarTab}
              {sectionCalendarEvents}
              {sectionCopy}
              {unscheduledCalendarEvents}
            />
          {/if}
        </section>

        <section id="exams" class="scroll-mt-4">
          <h2 class="mb-3 text-lg font-semibold tracking-tight">
            {sectionCopy.tabs.exams}
          </h2>
          {#if SectionExamSection}
            <svelte:component
              this={SectionExamSection}
              events={sectionExamEvents}
              {fmtDate}
              {sectionCopy}
            />
          {/if}
        </section>

        <section id="homework" class="scroll-mt-4">
          <div class="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 class="text-lg font-semibold tracking-tight">
              {sectionCopy.tabs.homeworks}
            </h2>
            {#if canWriteHomework}
              <Button type="button" onclick={openCreateHomeworkDialog}>
                {homeworkCopy.showCreate}
              </Button>
            {:else if !(viewer.isAuthenticated ?? viewer.signedIn === true)}
              <Button
                href={`/account/sign-in?callbackUrl=${encodeURIComponent(`/catalog/sections/${data.section.jwId}`)}`}
                variant="outline"
              >
                {homeworkCopy.loginToCreate}
              </Button>
            {/if}
          </div>
          {#if SectionHomeworkTab}
            <svelte:component
              this={SectionHomeworkTab}
              {fmtDateTime}
              {homeworkCopy}
              {homeworks}
              {sectionCopy}
              selectHomework={setSelectedHomework}
            />
          {/if}
        </section>

        <section id="comments" class="scroll-mt-4">
          {#key `comments:section:${data.section.id}`}
            {#if CommentsPanel}
              <svelte:component
                this={CommentsPanel}
                initialData={data.commentsData}
                targetType="section"
                targetId={data.section.id}
                targets={commentTargets}
                showAllTargets
                heading={sectionCopy.tabs.comments}
              />
            {/if}
          {/key}
        </section>
      </div>

      <aside class="min-w-0 lg:sticky lg:top-4" id="overview">
        <SectionBasicInfoCard
          {commonCopy}
          {notAvailable}
          {periodDetailRows}
          {primaryName}
          section={displaySection}
          {sectionCopy}
          {sectionTeachersLabel}
          {teacherName}
          teachers={displaySection.teachers}
          {yesNo}
        />
      </aside>
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
    <div class="px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
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
