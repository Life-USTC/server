<script lang="ts">
import { Button } from "$lib/components/ui/button/index.js";
import * as Dialog from "$lib/components/ui/dialog/index.js";
import SectionCreateHomeworkFields from "./SectionCreateHomeworkFields.svelte";
import type {
  SectionCreateHomeworkCommentsCopy,
  SectionCreateHomeworkCopy,
  SectionCreateHomeworkSectionCopy,
} from "./section-create-homework-types";

export let applyDueAtSemesterEnd: () => void;
export let applyDueInMonth: () => void;
export let applyDueInWeek: () => void;
export let applyPublishNow: () => void;
export let applyStartAtSemesterStart: () => void;
export let applyStartNow: () => void;
export let close: () => void;
export let commentsCopy: SectionCreateHomeworkCommentsCopy;
export let createHomework: (event: SubmitEvent) => void;
export let hasSemesterEnd: boolean;
export let hasSemesterStart: boolean;
export let homeworkCopy: SectionCreateHomeworkCopy;
export let homeworkMessage: string;
export let publishedAt: string;
export let sectionCopy: SectionCreateHomeworkSectionCopy;
export let show: boolean;
export let submissionDueAt: string;
export let submissionStartAt: string;
</script>

{#if show}
  <Dialog.Root
    open={true}
    onOpenChange={(open) => {
      if (!open) close();
    }}
  >
    <Dialog.Content
      class="max-w-2xl"
    >
      <form
        class="grid max-h-[calc(100vh-2rem)] gap-4 overflow-y-auto"
        onsubmit={createHomework}
      >
        <Dialog.Header>
          <Dialog.Title>{homeworkCopy.createTitle}</Dialog.Title>
          <Dialog.Description>{homeworkCopy.subtitle}</Dialog.Description>
        </Dialog.Header>
        <SectionCreateHomeworkFields
          {applyDueAtSemesterEnd}
          {applyDueInMonth}
          {applyDueInWeek}
          {applyPublishNow}
          {applyStartAtSemesterStart}
          {applyStartNow}
          {commentsCopy}
          {hasSemesterEnd}
          {hasSemesterStart}
          {homeworkCopy}
          {homeworkMessage}
          bind:publishedAt
          bind:submissionDueAt
          bind:submissionStartAt
        />
        <Dialog.Footer>
          <Button type="button" variant="outline" onclick={close}>
            {sectionCopy.close ?? ""}
          </Button>
          <Button type="submit">{homeworkCopy.createAction}</Button>
        </Dialog.Footer>
      </form>
    </Dialog.Content>
  </Dialog.Root>
{/if}
