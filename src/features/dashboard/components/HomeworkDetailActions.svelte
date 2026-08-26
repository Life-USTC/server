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
export let homeworkSavingById: Record<string, boolean>;
export let homeworkSectionHref: DashboardHomeworkDetailAction;
export let homeworksCopy: DashboardHomeworkDetailCopy;
export let selectedCourseLabel: string;
export let toggleHomeworkCompletion: DashboardHomeworkCompletionToggle;
</script>

<div class="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
  <Button
    class="w-full justify-start overflow-hidden sm:mr-auto sm:w-auto sm:max-w-[24rem]"
    href={homeworkSectionHref(homework)}
    variant="ghost"
  >
    <span class="truncate">{selectedCourseLabel}</span>
  </Button>
  <Button
    class="w-full sm:w-auto"
    disabled={homeworkSavingById[homework.id]}
    type="button"
    onclick={() => {
      if (homework) toggleHomeworkCompletion(homework);
    }}
  >
    <SelectedCompletionIcon data-icon="inline-start" />
    {homeworkSavingById[homework.id]
      ? homeworksCopy.saving
      : homeworkCompletionActionLabel(homework)}
  </Button>
</div>
