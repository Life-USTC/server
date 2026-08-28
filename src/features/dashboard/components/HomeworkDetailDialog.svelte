<script lang="ts">
import DetailDialog from "$lib/components/DetailDialog.svelte";
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
export let homeworksCopy: DashboardHomeworkDetailCopy;
export let homeworkStatus: DashboardHomeworkDetailAction;
export let onClose: () => void;
export let toggleHomeworkCompletion: DashboardHomeworkCompletionToggle;
</script>

{#if homework}
  {@const selected = homework}
  <!-- Cross-section list: the course is the disambiguating context, so it stays
       in the subtitle. One scrollable column: description, due summary,
       vertical metadata, action controls, then full-width discussion. -->
  <DetailDialog
    onClose={onClose}
    subtitle={homeworkCourseLabel(selected)}
    title={selected.title}
  >
    {#snippet body()}
      <HomeworkDetailDescription homework={selected} {homeworksCopy} />

      <HomeworkDetailMetadata
        {fmtDate}
        homework={selected}
        {homeworkEtaLabel}
        {homeworkStatus}
        {homeworksCopy}
      />

      <HomeworkDetailActions
        homework={selected}
        {homeworkCompletionActionLabel}
        {homeworkDetailHref}
        {homeworkSavingById}
        {homeworksCopy}
        {toggleHomeworkCompletion}
      />
    {/snippet}

    {#snippet aside()}
      <HomeworkDetailCommentsAside
        {CommentsPanel}
        homework={selected}
        {homeworksCopy}
      />
    {/snippet}
  </DetailDialog>
{/if}
