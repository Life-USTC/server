<script lang="ts">
import type { DashboardMyHomeworksCopy } from "@/features/dashboard/lib/dashboard-controller-types";
import DetailDialog from "$lib/components/DetailDialog.svelte";
import { Badge } from "$lib/components/ui/badge/index.js";
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
export let homeworkCopy: DashboardMyHomeworksCopy;
export let homeworkStatus: DashboardHomeworkDetailAction;
export let onClose: () => void;
export let toggleHomeworkCompletion: DashboardHomeworkCompletionToggle;
</script>

{#if homework}
  {@const selected = homework}
  {@const courseLabel = homeworkCourseLabel(selected)}
  <DetailDialog
    onClose={onClose}
    subtitle={`${courseLabel} · ${homeworkCopy.due}: ${fmtDate(selected.submissionDueAt)}`}
    title={selected.title}
  >
    {#snippet badges()}
      <Badge variant={selected.completion ? "default" : "outline"}>
        {homeworkStatus(selected)}
      </Badge>
    {/snippet}

    {#snippet body()}
      <HomeworkDetailDescription homework={selected} {homeworksCopy} />
      <HomeworkDetailMetadata
        {fmtDate}
        homework={selected}
        {homeworkEtaLabel}
        {homeworksCopy}
      />
    {/snippet}

    {#snippet aside()}
      <HomeworkDetailCommentsAside
        {CommentsPanel}
        homework={selected}
        {homeworksCopy}
      />
    {/snippet}

    {#snippet footer()}
      <HomeworkDetailActions
        homework={selected}
        {homeworkCompletionActionLabel}
        {homeworkDetailHref}
        {homeworkSavingById}
        {homeworksCopy}
        {toggleHomeworkCompletion}
      />
    {/snippet}
  </DetailDialog>
{/if}
