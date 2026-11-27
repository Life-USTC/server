<script lang="ts">
import type { Snippet } from "svelte";
export let content: Snippet<[typeof pageContent]>;

import * as Alert from "#lib/components/ui/alert/index.js";
import { Button } from "#lib/components/ui/button/index.js";
import { Separator } from "#lib/components/ui/separator/index.js";
import { Spinner } from "#lib/components/ui/spinner/index.js";
import DemoNotice from "@/features/demo/components/DemoNotice.svelte";
import type { SectionDetailPageData } from "@/features/section-detail/lib/section-detail-controller-helpers";
import type { SectionDetailSection } from "@/features/section-detail/lib/section-detail-controller-types";
import SectionDetailHeader from "./SectionDetailHeader.svelte";
import SectionDetailPrimaryActions from "./SectionDetailPrimaryActions.svelte";
import type { SectionDetailMainContentProps } from "./section-detail-dialog-types";

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
export let setSelectedHomework: SectionDetailMainContentProps["setSelectedHomework"];
export let retryStreamPanels: () => void;
export let streamError: string | null;
export let streamLoading: boolean;
export let teacherName: SectionDetailMainContentProps["teacherName"];
export let viewer: SectionDetailMainContentProps["viewer"];
export let yesNo: SectionDetailMainContentProps["yesNo"];

$: sectionExamEvents = sectionCalendarEvents.filter(
  (event) => event.kind === "exam",
);
$: pageContent = {
  data,
  descriptionData,
  sectionCopy,
  openCalendarDialog,
  roomMapCopy,
  sectionCalendarEvents,
  sectionExamEvents,
  fmtDate,
  fmtDateTime,
  viewer,
  canWriteHomework,
  openHomeworkAuditDialog,
  openCreateHomeworkDialog,
  homeworkCopy,
  homeworks,
  setSelectedHomework,
  commentTargets,
  commonCopy,
  notAvailable,
  periodDetailRows,
  primaryName,
  displaySection,
  teacherName,
  yesNo,
};
</script>

<div class="grid flex-1 grid-rows-[auto_minmax(0,1fr)_auto] bg-card lg:h-full lg:min-h-0 lg:grid-rows-[auto_minmax(0,1fr)]">
  <div class="detail-frame-gutter border-b bg-card" data-testid="detail-pinned-summary">
    <div class="page-frame page-frame-content">
      <SectionDetailHeader
        courseName={courseName}
        courseSecondaryName={courseSecondaryName}
        formError={formError}
        onOpenCalendar={openCalendarDialog}
        onOpenSubscribe={openSubscribeDialog}
        section={displaySection}
        sectionCopy={sectionCopy}
        viewer={viewer}
        readOnlyReason={data.demo?.readOnlyReason}
      />
    </div>
  </div>

  <div
    class="detail-frame-gutter @container/detail min-w-0 min-h-0 overflow-x-clip py-4 lg:overflow-x-hidden lg:overflow-y-auto"
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
            variant="outline"
            onclick={retryStreamPanels}
          >
            {sectionCopy.pleaseRetry}
          </Button>
        </Alert.Description>
      </Alert.Root>
    {/if}

    <div class="page-frame page-frame-content min-w-0" data-detail-reading-stream>
      {@render content(pageContent)}
    </div>
  </div>

  <div
    class="sticky bottom-0 z-10 bg-background md:hidden"
    data-testid="section-mobile-primary-actions"
  >
    <Separator />
    <div class="detail-frame-gutter py-3">
      <SectionDetailPrimaryActions
        onOpenCalendar={openCalendarDialog}
        onOpenSubscribe={openSubscribeDialog}
        retired={data.section.retiredAt != null}
        sectionCopy={sectionCopy}
        stretched
        viewer={viewer}
        readOnlyReason={data.demo?.readOnlyReason}
      />
    </div>
  </div>
</div>
