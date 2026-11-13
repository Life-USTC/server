<script lang="ts">
import CalendarIcon from "@lucide/svelte/icons/calendar";
import { onMount } from "svelte";
import LazyModuleStatus from "#lib/components/LazyModuleStatus.svelte";
import * as Alert from "#lib/components/ui/alert/index.js";
import { Button } from "#lib/components/ui/button/index.js";
import { Separator } from "#lib/components/ui/separator/index.js";
import { Spinner } from "#lib/components/ui/spinner/index.js";
import { cn } from "#lib/utils.js";
import DemoNotice from "@/features/demo/components/DemoNotice.svelte";
import type { SectionDetailPageData } from "@/features/section-detail/lib/section-detail-controller-helpers";
import type { SectionDetailSection } from "@/features/section-detail/lib/section-detail-controller-types";
import type { SubmitFunction } from "$app/forms";
import SectionBasicInfoCard from "./SectionBasicInfoCard.svelte";
import SectionDetailHeader from "./SectionDetailHeader.svelte";
import SectionDetailIdentity from "./SectionDetailIdentity.svelte";
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
export let openHomeworkAuditDialog: () => void;
export let openCreateHomeworkDialog: SectionDetailMainContentProps["openCreateHomeworkDialog"];
export let openSubscribeDialog: () => void;
export let periodDetailRows: SectionDetailMainContentProps["periodDetailRows"];
export let primaryName: SectionDetailMainContentProps["primaryName"];
export let roomMapCopy: SectionDetailMainContentProps["roomMapCopy"];
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

type ModuleKey = "description" | "calendar" | "exams" | "homework" | "comments";
let moduleErrors: Partial<Record<ModuleKey, boolean>> = {};
let modulePending: Partial<Record<ModuleKey, boolean>> = {};
let destroyed = false;

async function loadModule<T>(
  key: ModuleKey,
  load: () => Promise<{ default: T }>,
  apply: (component: T) => void,
) {
  if (destroyed || modulePending[key]) return;
  modulePending[key] = true;
  moduleErrors[key] = false;
  try {
    const result = await load();
    if (!destroyed) apply(result.default);
  } catch {
    if (!destroyed) moduleErrors[key] = true;
  } finally {
    if (!destroyed) modulePending[key] = false;
  }
}
const moduleLoaders = {
  description: () =>
    loadModule(
      "description",
      () => import("@/features/descriptions/components/DescriptionCard.svelte"),
      (component) => (DescriptionCard = component),
    ),
  calendar: () =>
    loadModule(
      "calendar",
      () => import("./SectionCalendarTab.svelte"),
      (component) => (SectionCalendarTab = component),
    ),
  exams: () =>
    loadModule(
      "exams",
      () => import("./SectionExamSection.svelte"),
      (component) => (SectionExamSection = component),
    ),
  homework: () =>
    loadModule(
      "homework",
      () => import("./SectionHomeworkTab.svelte"),
      (component) => (SectionHomeworkTab = component),
    ),
  comments: () =>
    loadModule(
      "comments",
      () => import("@/features/comments/components/CommentsPanel.svelte"),
      (component) => (CommentsPanel = component),
    ),
};
onMount(() => {
  for (const load of Object.values(moduleLoaders)) void load();
  return () => {
    destroyed = true;
  };
});

$: sectionExamEvents = sectionCalendarEvents.filter(
  (event) => event.kind === "exam",
);
</script>

<div class="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] bg-card lg:grid-rows-[auto_minmax(0,1fr)]">
  <div class="bg-card" data-testid="detail-pinned-summary">
    <div class="page-frame page-frame-content px-4 sm:px-5 lg:px-6">
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
        viewer={viewer}
        readOnlyReason={data.demo?.readOnlyReason}
      />
    </div>
  </div>

  <div
    class="@container/detail min-w-0 min-h-0 overflow-x-hidden overflow-y-auto px-4 py-4 sm:px-5 lg:px-6"
    aria-busy={streamLoading}
    data-detail-scroll-container
  >
    {#if data.demo}
      <div class="page-frame page-frame-content"><DemoNotice demo={data.demo} locale={data.locale} /></div>
    {/if}
    {#if streamLoading}
      <div
        class="page-frame page-frame-content text-muted-foreground flex items-center justify-center gap-2 px-2 py-6 text-sm"
        role="status"
      >
        <Spinner class="size-4 shrink-0" />
        <span>{data.locale === "zh-cn" ? "加载中..." : "Loading..."}</span>
      </div>
    {/if}

    {#if streamError}
      <Alert.Root class="page-frame page-frame-content mb-6" role="alert" variant="destructive">
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

    <div class="page-frame page-frame-content grid gap-8 @[60rem]/detail:grid-cols-[minmax(0,1fr)_minmax(16rem,20rem)] @[60rem]/detail:grid-rows-[auto_1fr] @[60rem]/detail:items-start @[60rem]/detail:gap-10">
      <div class="min-w-0 @[60rem]/detail:col-start-2 @[60rem]/detail:row-start-1" data-detail-identity>
        <SectionDetailIdentity
          notAvailable={notAvailable}
          primaryName={primaryName}
          section={displaySection}
          sectionCopy={sectionCopy}
          teacherName={teacherName}
          teachers={displaySection.teachers}
        />
      </div>
      <div class="grid min-w-0 grid-cols-1 gap-10 @[60rem]/detail:col-start-1 @[60rem]/detail:row-start-1 @[60rem]/detail:row-span-2" data-detail-reading-stream>
        <section id="introduction" class="scroll-mt-4">
          {#key `description:section:${data.section.id}`}
            {#if DescriptionCard}
              <svelte:component
                this={DescriptionCard}
                resolveViewer
                targetType="section"
                targetId={data.section.id}
                initialData={descriptionData}
                locale={data.locale}
                copy={data.copy.descriptions}
                heading={data.copy.descriptions.title}
                showTitle={false}
                readOnlyReason={data.demo?.readOnlyReason}
              />
            {:else}
              <h2 class="mb-3 text-lg font-semibold tracking-tight">
                {data.copy.descriptions.title}
              </h2>
              {#if descriptionData.description.renderedHtml}
                <div class="markdown-preview" data-slot="markdown-preview">
                  {@html descriptionData.description.renderedHtml}
                </div>
              {/if}
              {#if moduleErrors.description || !descriptionData.description.renderedHtml}
                <LazyModuleStatus failed={Boolean(moduleErrors.description)} heading={data.copy.descriptions.title} loadFailed={data.copy.descriptions.loadFailed} retry={data.copy.descriptions.retry} onRetry={() => void moduleLoaders.description()} />
              {/if}
            {/if}
          {/key}
          {#if data.demo}
            <a class="mt-3 inline-flex text-sm underline underline-offset-4" href={`/catalog/courses/${data.section.course.jwId}`}>{data.copy.comments.viewCourse}</a>
          {/if}
        </section>

        <section id="calendar" class="min-w-0 scroll-mt-4">
          <div class="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 class="text-lg font-semibold tracking-tight">
              {sectionCopy.tabs.calendar}
            </h2>
            <Button variant="outline" type="button" onclick={openCalendarDialog} disabled={Boolean(data.demo)} title={data.demo?.readOnlyReason}>
              <CalendarIcon data-icon="inline-start" />
              {sectionCopy.addToCalendar}
            </Button>
          </div>
          {#if SectionCalendarTab}
            <svelte:component this={SectionCalendarTab}
              roomMapCopy={roomMapCopy}
              pageDemo={data.demo}
              locale={data.locale}
              sectionCalendarEvents={sectionCalendarEvents}
              sectionCopy={sectionCopy}
              unscheduledCalendarEvents={unscheduledCalendarEvents}
             />
          {:else}
            <LazyModuleStatus failed={Boolean(moduleErrors.calendar)} heading={sectionCopy.tabs.calendar} loadFailed={data.copy.common.error} retry={sectionCopy.pleaseRetry} onRetry={() => void moduleLoaders.calendar()} />
          {/if}
        </section>

        <section id="exams" class="min-w-0 scroll-mt-4">
          <h2 class="mb-3 text-lg font-semibold tracking-tight">
            {sectionCopy.tabs.exams}
          </h2>
          {#if SectionExamSection}
            <svelte:component
              this={SectionExamSection}
              events={sectionExamEvents}
              fmtDate={fmtDate}
              heading={sectionCopy.tabs.exams}
              roomMapCopy={roomMapCopy}
              pageDemo={data.demo}
              locale={data.locale}
              sectionCopy={sectionCopy}
             />
          {:else}
            <LazyModuleStatus failed={Boolean(moduleErrors.exams)} heading={sectionCopy.tabs.exams} loadFailed={data.copy.common.error} retry={sectionCopy.pleaseRetry} onRetry={() => void moduleLoaders.exams()} />
          {/if}
        </section>

        <section id="homework" class="scroll-mt-4">
          <div class="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 class="text-lg font-semibold tracking-tight">
              {sectionCopy.tabs.homeworks}
            </h2>
            <div class="flex flex-wrap items-center gap-2">
            {#if !data.demo && !viewer.loading && !viewer.failed && (viewer.isAuthenticated ?? viewer.signedIn === true)}
              <Button type="button" variant="outline" class="min-h-11 sm:min-h-9 md:min-h-9" onclick={openHomeworkAuditDialog}>{homeworkCopy.auditTitle}</Button>
            {/if}
            {#if data.demo}
              <Button type="button" disabled title={data.demo.readOnlyReason}>{homeworkCopy.showCreate}</Button>
            {:else if canWriteHomework}
              <Button type="button" onclick={openCreateHomeworkDialog}>
                {homeworkCopy.showCreate}
              </Button>
            {:else if !viewer.loading && !viewer.failed && !(viewer.isAuthenticated ?? viewer.signedIn === true)}
              <Button
                href={`/account/sign-in?callbackUrl=${encodeURIComponent(`/catalog/sections/${data.section.jwId}`)}`}
                variant="outline"
              >
                {homeworkCopy.loginToCreate}
              </Button>
            {/if}
            </div>
          </div>
          {#if SectionHomeworkTab}
            <svelte:component this={SectionHomeworkTab}
              fmtDateTime={fmtDateTime}
              homeworkCopy={homeworkCopy}
              homeworks={homeworks}
              locale={data.locale}
              showPersonalStatus={!data.demo && !viewer.loading && !viewer.failed && (viewer.isAuthenticated ?? viewer.signedIn === true)}
              sectionCopy={sectionCopy}
              selectHomework={setSelectedHomework}
            />
          {:else}
            <LazyModuleStatus failed={Boolean(moduleErrors.homework)} heading={sectionCopy.tabs.homeworks} loadFailed={data.copy.common.error} retry={sectionCopy.pleaseRetry} onRetry={() => void moduleLoaders.homework()} />
          {/if}
        </section>

        <section id="comments" class="scroll-mt-4 min-w-0">
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
                readOnlyReason={data.demo?.readOnlyReason}
              />
            {:else}
              <h2 class="mb-3 text-lg font-semibold tracking-tight">{sectionCopy.tabs.comments}</h2>
              <LazyModuleStatus failed={Boolean(moduleErrors.comments)} heading={sectionCopy.tabs.comments} loadFailed={data.copy.comments.loadFailed} retry={data.copy.comments.retry} onRetry={() => void moduleLoaders.comments()} />
            {/if}
          {/key}
        </section>
      </div>

      <aside class="min-w-0 @[60rem]/detail:col-start-2 @[60rem]/detail:row-start-2" id="overview">
        <SectionBasicInfoCard
          commonCopy={commonCopy}
          notAvailable={notAvailable}
          periodDetailRows={periodDetailRows}
          primaryName={primaryName}
          section={displaySection}
          sectionCopy={sectionCopy}
          sectionTeachersLabel={sectionTeachersLabel}
          yesNo={yesNo}
        />
      </aside>
    </div>
  </div>

  <div
    class="sticky bottom-0 z-10 bg-background md:hidden"
    data-testid="section-mobile-primary-actions"
  >
    <Separator />
    <div class="px-3 pt-3 pb-3">
      <SectionDetailPrimaryActions
        {courseName}
        onOpenCalendar={openCalendarDialog}
        onOpenSubscribe={openSubscribeDialog}
        retired={data.section.retiredAt != null}
        sectionCopy={sectionCopy}
        stretched
        subscriptionAction={subscriptionAction}
        subscriptionPendingAction={subscriptionPendingAction}
        viewer={viewer}
        readOnlyReason={data.demo?.readOnlyReason}
      />
    </div>
  </div>
</div>
