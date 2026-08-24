<script lang="ts">
import CheckCircleIcon from "@lucide/svelte/icons/check-circle";
import RefreshCw from "@lucide/svelte/icons/refresh-cw";
import type { DashboardMyHomeworksCopy } from "@/features/dashboard/lib/dashboard-controller-types";
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
import HomeworkDetailCommentsAside from "./HomeworkDetailCommentsAside.svelte";
import HomeworkDetailDescription from "./HomeworkDetailDescription.svelte";
import HomeworkDetailMetadata from "./HomeworkDetailMetadata.svelte";

export let CommentsPanel: DashboardHomeworkCommentsPanel;

export let fmtDate: DashboardHomeworkDetailFormatter;
export let homework: DashboardHomeworkDetailItem | null;
export let homeworkCompletionActionLabel: DashboardHomeworkDetailAction;
export let homeworkDetailHref: DashboardHomeworkDetailAction;
export let homeworkEtaLabel: DashboardHomeworkDetailFormatter;
export let homeworkCourseLabel: DashboardHomeworkDetailAction;
export let homeworkSavingById: Record<string, boolean>;
export let homeworkSectionHref: DashboardHomeworkDetailAction;
export let homeworksCopy: DashboardHomeworkDetailCopy;
export let homeworkCopy: DashboardMyHomeworksCopy;
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
      class="flex h-[calc(100dvh-2rem)] max-h-[calc(100dvh-2rem)] min-h-0 max-w-5xl flex-col gap-0 overflow-clip p-0 sm:h-[min(76vh,52rem)] sm:max-h-[min(76vh,52rem)] sm:max-w-5xl"
    >
      {@const selectedCourseLabel = homeworkCourseLabel(homework)}
      {@const SelectedCompletionIcon = homework.completion ? RefreshCw : CheckCircleIcon}
      <Dialog.Header class="shrink-0 px-5 pb-2 pt-4">
        <Dialog.Title class="break-words">{homework.title}</Dialog.Title>
        <Dialog.Description>
          {selectedCourseLabel} · {homeworkCopy.due}:
          {fmtDate(homework.submissionDueAt)}
        </Dialog.Description>
      </Dialog.Header>
      <ScrollArea class="h-0 min-h-0 flex-1">
        <div class="grid gap-5 px-5 py-4 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,24rem)]">
          <div class="grid min-w-0 gap-4">
            <HomeworkDetailDescription
              {homework}
              {homeworksCopy}
            />

            <HomeworkDetailMetadata
              {fmtDate}
              {homework}
              {homeworkEtaLabel}
              {homeworksCopy}
              {homeworkStatus}
            />
          </div>
          <HomeworkDetailCommentsAside
            {CommentsPanel}
            {homework}
            {homeworksCopy}
          />
        </div>
      </ScrollArea>
      <Dialog.Footer class="mx-0 mb-0 shrink-0 p-4">
        <HomeworkDetailActions
          {SelectedCompletionIcon}
          {homework}
          {homeworkCompletionActionLabel}
          {homeworkDetailHref}
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
