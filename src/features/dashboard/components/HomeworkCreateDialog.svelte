<script lang="ts">
import type { SubmitFunction } from "@sveltejs/kit";
import { enhance } from "$app/forms";
import { Button } from "$lib/components/ui/button/index.js";
import * as Dialog from "$lib/components/ui/dialog/index.js";
import type {
  DashboardHomeworkCommentsCopy,
  DashboardHomeworkCreateCopy,
  DashboardHomeworkCreateSection,
  DashboardHomeworkCreateSectionGetter,
  DashboardHomeworkDateShortcut,
} from "./dashboard-homework-create-types";
import HomeworkCreateFormFields from "./HomeworkCreateFormFields.svelte";

export let HOMEWORK_DESCRIPTION_MAX_LENGTH: number;
export let HOMEWORK_TITLE_MAX_LENGTH: number;
export let applyHomeworkDueAtSemesterEnd: DashboardHomeworkDateShortcut;
export let applyHomeworkDueInMonth: DashboardHomeworkDateShortcut;
export let applyHomeworkDueInWeek: DashboardHomeworkDateShortcut;
export let applyHomeworkStartNow: DashboardHomeworkDateShortcut;
export let commentsCopy: DashboardHomeworkCommentsCopy;
export let createHomeworkAction: SubmitFunction;
export let createHomeworkAdvancedOpen: boolean;
export let createHomeworkError: string;
export let createHomeworkPublishedAt: string;
export let createHomeworkSectionId: string;
export let createHomeworkSubmissionDueAt: string;
export let createHomeworkSubmissionStartAt: string;
export let homeworkSectionLabel: (
  section: DashboardHomeworkCreateSection,
) => string;
export let homeworksCopy: DashboardHomeworkCreateCopy;
export let isCreatingHomework: boolean;
export let onClose: () => void;
export let open: boolean;
export let sections: DashboardHomeworkCreateSection[];
export let selectedCreateHomeworkSection: DashboardHomeworkCreateSectionGetter;
export let toShanghaiDateTimeLocalValue: (value: Date) => string;
</script>

{#if open}
  <Dialog.Root
    class="max-w-lg"
    open={true}
    onOpenChange={(nextOpen) => {
      if (!nextOpen) onClose();
    }}
  >
    <form method="POST" action="?/createHomework" use:enhance={createHomeworkAction}>
      <Dialog.Header>
        <Dialog.Title>{homeworksCopy.createTitle}</Dialog.Title>
        <Dialog.Description>{homeworksCopy.subtitle}</Dialog.Description>
      </Dialog.Header>
      <HomeworkCreateFormFields
        {HOMEWORK_DESCRIPTION_MAX_LENGTH}
        {HOMEWORK_TITLE_MAX_LENGTH}
        {applyHomeworkDueAtSemesterEnd}
        {applyHomeworkDueInMonth}
        {applyHomeworkDueInWeek}
        {applyHomeworkStartNow}
        {commentsCopy}
        bind:createHomeworkAdvancedOpen
        {createHomeworkError}
        bind:createHomeworkPublishedAt
        bind:createHomeworkSectionId
        bind:createHomeworkSubmissionDueAt
        bind:createHomeworkSubmissionStartAt
        {homeworkSectionLabel}
        {homeworksCopy}
        {isCreatingHomework}
        {sections}
        {selectedCreateHomeworkSection}
        {toShanghaiDateTimeLocalValue}
      />
      <Dialog.Footer>
        <Button
          disabled={isCreatingHomework}
          type="button"
          variant="outline"
          onclick={onClose}
        >
          {homeworksCopy.cancel}
        </Button>
        <Button
          data-testid="dashboard-homework-create"
          disabled={isCreatingHomework}
          type="submit"
        >
          {isCreatingHomework ? homeworksCopy.saving : homeworksCopy.createAction}
        </Button>
      </Dialog.Footer>
    </form>
  </Dialog.Root>
{/if}
