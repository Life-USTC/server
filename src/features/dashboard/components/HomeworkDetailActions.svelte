<script lang="ts">
import CheckCircleIcon from "@lucide/svelte/icons/check-circle";
import RotateCcwIcon from "@lucide/svelte/icons/rotate-ccw";
import { Button } from "$lib/components/ui/button/index.js";
import { Separator } from "$lib/components/ui/separator/index.js";
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

<div class="grid gap-4">
  <Separator />
  <div class="flex flex-wrap items-center justify-end gap-2">
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
  </div>
</div>
