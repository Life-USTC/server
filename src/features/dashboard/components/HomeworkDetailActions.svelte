<script lang="ts">
import type { Component } from "svelte";
import { Button } from "$lib/components/ui/button/index.js";
import type {
  DashboardHomeworkCompletionToggle,
  DashboardHomeworkDetailAction,
  DashboardHomeworkDetailCopy,
  DashboardHomeworkDetailItem,
} from "./dashboard-homework-detail-types";

export let SelectedCompletionIcon: Component;
export let homework: DashboardHomeworkDetailItem;
export let homeworkCompletionActionLabel: DashboardHomeworkDetailAction;
export let homeworkDetailHref: DashboardHomeworkDetailAction;
export let homeworkSavingById: Record<string, boolean>;
export let homeworkSectionHref: DashboardHomeworkDetailAction;
export let homeworksCopy: DashboardHomeworkDetailCopy;
export let selectedCourseLabel: string;
export let toggleHomeworkCompletion: DashboardHomeworkCompletionToggle;
</script>

<div class="flex flex-wrap items-center justify-between gap-2 border-base-300 border-t pt-4">
  <Button href={homeworkSectionHref(homework)} variant="outline">
    {selectedCourseLabel}
  </Button>
  <div class="flex flex-wrap justify-end gap-2">
    <Button
      disabled={homeworkSavingById[homework.id]}
      type="button"
      variant="outline"
      onclick={() => {
        if (homework) toggleHomeworkCompletion(homework);
      }}
    >
      <SelectedCompletionIcon />
      {homeworkSavingById[homework.id]
        ? homeworksCopy.saving
        : homeworkCompletionActionLabel(homework)}
    </Button>
    <Button href={homeworkDetailHref(homework)}>
      {homeworksCopy.viewDetails}
    </Button>
  </div>
</div>
