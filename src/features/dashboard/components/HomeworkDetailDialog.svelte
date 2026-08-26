<script lang="ts">
import CheckCircleIcon from "@lucide/svelte/icons/check-circle";
import RefreshCw from "@lucide/svelte/icons/refresh-cw";
import * as Dialog from "$lib/components/ui/dialog/index.js";
import { ScrollArea } from "$lib/components/ui/scroll-area/index.js";
import type {
  DashboardHomeworkCommentsPanel,
  DashboardHomeworkCompletionToggle,
  DashboardHomeworkDetailAction,
  DashboardHomeworkDetailCopy,
  DashboardHomeworkDetailFormatter,
  DashboardHomeworkDetailItem,
} from "./dashboard-homework-detail-types";
import HomeworkDetailActions from "./HomeworkDetailActions.svelte";
import HomeworkDetailDescription from "./HomeworkDetailDescription.svelte";
import HomeworkDetailDiscussion from "./HomeworkDetailDiscussion.svelte";
import HomeworkDetailMetadata from "./HomeworkDetailMetadata.svelte";

export let CommentsPanel: DashboardHomeworkCommentsPanel;

export let fmtDate: DashboardHomeworkDetailFormatter;
export let homework: DashboardHomeworkDetailItem | null;
export let homeworkCompletionActionLabel: DashboardHomeworkDetailAction;
export let homeworkEtaLabel: DashboardHomeworkDetailFormatter;
export let homeworkCourseLabel: DashboardHomeworkDetailAction;
export let homeworkSavingById: Record<string, boolean>;
export let homeworkSectionHref: DashboardHomeworkDetailAction;
export let homeworksCopy: DashboardHomeworkDetailCopy;
export let homeworkStatus: DashboardHomeworkDetailAction;
export let onClose: () => void;
export let toggleHomeworkCompletion: DashboardHomeworkCompletionToggle;
</script>

{#if homework}
  <Dialog.Root
    open={true}
    onOpenChange={(open) => {
      if (!open) onClose();
    }}
  >
    <Dialog.Content
      class="inset-0 flex h-dvh max-h-dvh w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-clip rounded-none p-0 sm:top-1/2 sm:left-1/2 sm:h-[min(68vh,40rem)] sm:max-h-[min(68vh,40rem)] sm:w-[calc(100%-2rem)] sm:max-w-3xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl"
      data-homework-id={homework.id}
    >
      {@const selectedCourseLabel = homeworkCourseLabel(homework)}
      {@const SelectedCompletionIcon = homework.completion ? RefreshCw : CheckCircleIcon}
      <Dialog.Header class="shrink-0 border-b px-6 py-5 pr-14">
        <Dialog.Title class="break-words">{homework.title}</Dialog.Title>
        <Dialog.Description>{selectedCourseLabel}</Dialog.Description>
      </Dialog.Header>
      <ScrollArea class="h-0 min-h-0 flex-1">
        <div class="grid min-w-0 gap-6 px-6 py-6">
          <HomeworkDetailMetadata
            {fmtDate}
            {homework}
            {homeworkEtaLabel}
            {homeworksCopy}
            {homeworkStatus}
          />
          <HomeworkDetailDescription {homework} {homeworksCopy} />
          <HomeworkDetailDiscussion
            {CommentsPanel}
            {homework}
            {homeworksCopy}
          />
        </div>
      </ScrollArea>
      <Dialog.Footer class="mx-0 mb-0 shrink-0 rounded-none p-4 sm:rounded-b-xl sm:px-6">
        <HomeworkDetailActions
          {SelectedCompletionIcon}
          {homework}
          {homeworkCompletionActionLabel}
          {homeworkSavingById}
          {homeworkSectionHref}
          {homeworksCopy}
          {selectedCourseLabel}
          {toggleHomeworkCompletion}
        />
      </Dialog.Footer>
    </Dialog.Content>
  </Dialog.Root>
{/if}
