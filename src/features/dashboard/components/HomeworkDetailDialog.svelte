<script lang="ts">
// biome-ignore-all lint/suspicious/noExplicitAny: route-owned callbacks, CommentsPanel, and page-shaped dashboard data are passed from the dashboard page boundary.
import CheckCircleIcon from "$lib/components/icons/check-circle.svelte";
import RefreshCw from "$lib/components/icons/refresh-cw.svelte";
import * as Dialog from "$lib/components/ui/dialog/index.js";
import HomeworkDetailActions from "./HomeworkDetailActions.svelte";
import HomeworkDetailCommentsAside from "./HomeworkDetailCommentsAside.svelte";
import HomeworkDetailDescription from "./HomeworkDetailDescription.svelte";
import HomeworkDetailMetadata from "./HomeworkDetailMetadata.svelte";

export let CommentsPanel: any;

export let fmtDate: (value: string | Date | null | undefined) => string;
export let homework: any | null;
export let homeworkCompletionActionLabel: (homework: any) => string;
export let homeworkDetailHref: (homework: any) => string;
export let homeworkEtaLabel: (
  value: string | Date | null | undefined,
) => string;
export let homeworkCourseLabel: (homework: any) => string;
export let homeworkSavingById: Record<string, boolean>;
export let homeworkSectionHref: (homework: any) => string;
export let homeworksCopy: any;
export let homeworkCopy: any;
export let homeworkStatus: (homework: any) => string;
export let onClose: () => void;
export let toggleHomeworkCompletion: (homework: any) => void;
</script>

{#if homework}
  <Dialog.Root
    open={true}
    class="max-h-[calc(100vh-2rem)] max-w-5xl overflow-y-auto"
    onOpenChange={(open) => {
      if (!open) onClose();
    }}
  >
    {@const selectedCourseLabel = homeworkCourseLabel(homework)}
    {@const SelectedCompletionIcon = homework.completion ? RefreshCw : CheckCircleIcon}
    <Dialog.Header>
      <Dialog.Title>{homework.title}</Dialog.Title>
      <Dialog.Description>
        {selectedCourseLabel} · {homeworkCopy.due}
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
  </Dialog.Root>
{/if}
