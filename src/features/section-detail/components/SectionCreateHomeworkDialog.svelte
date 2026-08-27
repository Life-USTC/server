<script lang="ts">
import { Button } from "$lib/components/ui/button/index.js";
import * as Dialog from "$lib/components/ui/dialog/index.js";
import { ScrollArea } from "$lib/components/ui/scroll-area/index.js";
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
export let openAuditDialog: (() => void) | null = null;
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
      class="flex h-[calc(100dvh-2rem)] max-h-[calc(100dvh-2rem)] min-h-0 max-w-2xl flex-col gap-0 overflow-clip p-0 sm:h-[min(78vh,48rem)] sm:max-h-[min(78vh,48rem)] sm:max-w-2xl"
    >
      <form
        class="flex min-h-0 flex-1 flex-col overflow-hidden"
        onsubmit={createHomework}
      >
        <Dialog.Header class="shrink-0 px-5 pb-2 pt-5 sm:px-6 sm:pt-6">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div class="min-w-0 grid gap-1.5">
              <Dialog.Title class="break-words">{homeworkCopy.createTitle}</Dialog.Title>
              <Dialog.Description>{homeworkCopy.subtitle}</Dialog.Description>
            </div>
            {#if openAuditDialog}
              <Button type="button" variant="outline" onclick={openAuditDialog}>
                {homeworkCopy.auditTitle}
              </Button>
            {/if}
          </div>
        </Dialog.Header>
        <ScrollArea class="h-0 min-h-0 flex-1">
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
        </ScrollArea>
        <Dialog.Footer class="mx-0 mb-0 shrink-0 border-t-0 sm:px-6">
          <Button type="button" variant="outline" onclick={close}>
            {sectionCopy.close ?? ""}
          </Button>
          <Button type="submit">{homeworkCopy.createAction}</Button>
        </Dialog.Footer>
      </form>
    </Dialog.Content>
  </Dialog.Root>
{/if}
