<script lang="ts">
import CheckCircleIcon from "@lucide/svelte/icons/check-circle";
import RotateCcwIcon from "@lucide/svelte/icons/rotate-ccw";
import { Button } from "$lib/components/ui/button/index.js";
import type {
  DashboardHomeworkCompletionToggle,
  DashboardHomeworkDetailAction,
  DashboardHomeworkDetailCopy,
  DashboardHomeworkDetailItem,
} from "./dashboard-homework-detail-types";

export let homework: DashboardHomeworkDetailItem;
export let homeworkCompletionActionLabel: DashboardHomeworkDetailAction;
export let homeworkDetailHref: DashboardHomeworkDetailAction;
export let homeworkSavingById: Record<string, boolean>;
export let homeworksCopy: DashboardHomeworkDetailCopy;
export let toggleHomeworkCompletion: DashboardHomeworkCompletionToggle;
</script>

<Button
  disabled={homeworkSavingById[homework.id]}
  type="button"
  variant="outline"
  onclick={() => {
    toggleHomeworkCompletion(homework);
  }}
>
  {#if homework.completion}
    <RotateCcwIcon data-icon="inline-start" />
  {:else}
    <CheckCircleIcon data-icon="inline-start" />
  {/if}
  {homeworkSavingById[homework.id]
    ? homeworksCopy.saving
    : homeworkCompletionActionLabel(homework)}
</Button>
<Button href={homeworkDetailHref(homework)}>
  {homeworksCopy.viewDetails}
</Button>
