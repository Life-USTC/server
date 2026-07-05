<script lang="ts">
import type { SubmitFunction } from "@sveltejs/kit";
import { enhance } from "$app/forms";
import { Button } from "$lib/components/ui/button/index.js";
import * as Dialog from "$lib/components/ui/dialog/index.js";
import { Spinner } from "$lib/components/ui/spinner/index.js";
import type {
  DashboardHomeworkCommentsCopy,
  DashboardHomeworkCreateCopy,
  DashboardHomeworkCreateSection,
  DashboardHomeworkCreateSectionGetter,
  DashboardHomeworkDateShortcut,
} from "./dashboard-homework-create-types";
import HomeworkCreateFormFields from "./HomeworkCreateFormFields.svelte";

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
    open={true}
    onOpenChange={(nextOpen) => {
      if (!nextOpen) onClose();
    }}
  >
    <Dialog.Content
      class="max-w-lg sm:max-w-lg"
    >
      <form method="POST" action="?/createHomework" use:enhance={createHomeworkAction}>
        <Dialog.Header>
          <Dialog.Title>{homeworksCopy.createTitle}</Dialog.Title>
          <Dialog.Description>{homeworksCopy.subtitle}</Dialog.Description>
        </Dialog.Header>
        <HomeworkCreateFormFields
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
            {#if isCreatingHomework}
              <Spinner data-icon="inline-start" />
            {/if}
            {isCreatingHomework ? homeworksCopy.saving : homeworksCopy.createAction}
          </Button>
        </Dialog.Footer>
      </form>
    </Dialog.Content>
  </Dialog.Root>
{/if}
