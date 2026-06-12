<script lang="ts">
import DateTimePicker from "$lib/components/DateTimePicker.svelte";
import { Button } from "$lib/components/ui/button/index.js";
import type {
  DashboardHomeworkCreateCopy,
  DashboardHomeworkDateShortcut,
} from "./dashboard-homework-create-types";

export let applyHomeworkStartNow: DashboardHomeworkDateShortcut;
export let createHomeworkPublishedAt: string;
export let createHomeworkSubmissionStartAt: string;
export let homeworksCopy: DashboardHomeworkCreateCopy;
export let isCreatingHomework: boolean;
export let toShanghaiDateTimeLocalValue: (value: Date) => string;
</script>

<div class="grid gap-3 sm:grid-cols-2">
  <label class="grid gap-2">
    <span class="font-medium text-sm">{homeworksCopy.publishedAt}</span>
    <DateTimePicker
      bind:value={createHomeworkPublishedAt}
      disabled={isCreatingHomework}
      defaultTime="00:00"
      name="publishedAt"
      placeholder={homeworksCopy.publishedAt}
    />
    <div class="flex justify-end gap-2">
      <Button
        disabled={isCreatingHomework}
        size="sm"
        type="button"
        variant="ghost"
        onclick={() => {
          createHomeworkPublishedAt = toShanghaiDateTimeLocalValue(new Date());
        }}
      >
        {homeworksCopy.helperPublishNow}
      </Button>
      <Button
        disabled={isCreatingHomework}
        size="sm"
        type="button"
        variant="ghost"
        onclick={() => {
          createHomeworkPublishedAt = "";
        }}
      >
        {homeworksCopy.helperClear}
      </Button>
    </div>
  </label>
  <label class="grid gap-2">
    <span class="font-medium text-sm">{homeworksCopy.submissionStart}</span>
    <DateTimePicker
      bind:value={createHomeworkSubmissionStartAt}
      disabled={isCreatingHomework}
      defaultTime="00:00"
      name="submissionStartAt"
      placeholder={homeworksCopy.submissionStart}
    />
    <div class="flex justify-end gap-2">
      <Button disabled={isCreatingHomework} size="sm" type="button" variant="ghost" onclick={applyHomeworkStartNow}>
        {homeworksCopy.helperStartNow}
      </Button>
      <Button
        disabled={isCreatingHomework}
        size="sm"
        type="button"
        variant="ghost"
        onclick={() => {
          createHomeworkSubmissionStartAt = "";
        }}
      >
        {homeworksCopy.helperClear}
      </Button>
    </div>
  </label>
</div>
