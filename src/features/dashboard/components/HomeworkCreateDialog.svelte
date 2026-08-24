<script lang="ts">
import type { SubmitFunction } from "@sveltejs/kit";
import { enhance } from "$app/forms";
import { Button } from "$lib/components/ui/button/index.js";
import * as Dialog from "$lib/components/ui/dialog/index.js";
import { ScrollArea } from "$lib/components/ui/scroll-area/index.js";
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
      class="flex max-h-[calc(100dvh-1rem)] min-h-0 max-w-lg flex-col gap-0 overflow-hidden p-0 sm:max-w-lg"
    >
      <form
        class="flex min-h-0 flex-1 flex-col"
        method="POST"
        action="?/createHomework"
        use:enhance={createHomeworkAction}
      >
        <Dialog.Header class="shrink-0 px-5 pb-2 pt-4">
          <Dialog.Title>{homeworksCopy.createTitle}</Dialog.Title>
          <Dialog.Description>{homeworksCopy.subtitle}</Dialog.Description>
        </Dialog.Header>
        <ScrollArea class="h-0 min-h-0 flex-1">
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
        </ScrollArea>
        <Dialog.Footer class="mx-0 mb-0 shrink-0">
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
