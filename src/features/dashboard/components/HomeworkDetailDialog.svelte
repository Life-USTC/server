<script lang="ts">
import CheckCircleIcon from "@lucide/svelte/icons/check-circle";
import RefreshCw from "@lucide/svelte/icons/refresh-cw";
import type { DashboardMyHomeworksCopy } from "@/features/dashboard/lib/dashboard-controller-types";
import * as Dialog from "$lib/components/ui/dialog/index.js";
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
      class="max-h-[calc(100vh-2rem)] max-w-5xl overflow-y-auto"
    >
      {@const selectedCourseLabel = homeworkCourseLabel(homework)}
      {@const SelectedCompletionIcon = homework.completion ? RefreshCw : CheckCircleIcon}
      <Dialog.Header>
        <Dialog.Title>{homework.title}</Dialog.Title>
        <Dialog.Description>
          {selectedCourseLabel} · {homeworkCopy.due}:
          {fmtDate(homework.submissionDueAt)}
        </Dialog.Description>
      </Dialog.Header>
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
        </div>
        <HomeworkDetailCommentsAside
          {CommentsPanel}
          {homework}
          {homeworksCopy}
        />
      </div>
    </Dialog.Content>
  </Dialog.Root>
{/if}
