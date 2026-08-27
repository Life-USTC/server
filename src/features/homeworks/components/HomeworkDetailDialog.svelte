<script lang="ts">
import CheckCircleIcon from "@lucide/svelte/icons/check-circle";
import RefreshCwIcon from "@lucide/svelte/icons/refresh-cw";
import type { Snippet } from "svelte";
import { onMount } from "svelte";
import {
  type HomeworkDateValue,
  type HomeworkDeadlineState,
  type HomeworkDetailModel,
  homeworkDeadlineState,
} from "@/features/homeworks/lib/homework-presentation";
import { Button } from "$lib/components/ui/button/index.js";
import * as Dialog from "$lib/components/ui/dialog/index.js";
import { ScrollArea } from "$lib/components/ui/scroll-area/index.js";
import HomeworkDeadlineSummary from "./HomeworkDeadlineSummary.svelte";
import HomeworkDetailDescription from "./HomeworkDetailDescription.svelte";
import HomeworkDetailDiscussion from "./HomeworkDetailDiscussion.svelte";
import HomeworkDetailSecondaryDetails from "./HomeworkDetailSecondaryDetails.svelte";
import type {
  HomeworkDetailCommentsPanel,
  HomeworkDetailCopy,
  HomeworkDetailDateFormatter,
  HomeworkDetailRelativeFormatter,
  HomeworkDetailToggle,
} from "./homework-detail-types";

export let CommentsPanel: HomeworkDetailCommentsPanel;
export let additionalContent: Snippet | undefined = undefined;
export let completionSaving = false;
export let contextActions: Snippet | undefined = undefined;
export let contextHref: string | null = null;
export let contextLabel: string | null = null;
export let copy: HomeworkDetailCopy;
export let dateFallback: string;
export let deadlineState:
  | ((value: HomeworkDateValue) => HomeworkDeadlineState)
  | undefined = undefined;
export let editing = false;
export let editingContent: Snippet | undefined = undefined;
export let fmtDate: HomeworkDetailDateFormatter;
export let homework: HomeworkDetailModel | null;
export let onClose: () => void;
export let onToggleCompletion: HomeworkDetailToggle | undefined = undefined;
export let permalinkBaseHref: string | null = null;
export let relativeEtaLabel: HomeworkDetailRelativeFormatter;
export let showContextActions = true;
export let showCompletion = false;
export let referenceDate: HomeworkDateValue = null;

let liveReferenceDate = referenceDate ? new Date(referenceDate) : new Date();
let resolvedDeadlineState: HomeworkDeadlineState = "unset";

$: if (homework) {
  resolvedDeadlineState = deadlineState
    ? deadlineState(homework.submissionDueAt)
    : homeworkDeadlineState(
        homework.submissionDueAt,
        referenceDate ?? liveReferenceDate,
      );
}

onMount(() => {
  const timer = window.setInterval(() => {
    liveReferenceDate = new Date();
  }, 60_000);
  return () => window.clearInterval(timer);
});
</script>

{#if homework}
  <Dialog.Root
    open={true}
    onOpenChange={(open) => {
      if (!open) onClose();
    }}
  >
    <Dialog.Content
      class="inset-0 flex h-dvh max-h-dvh w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-clip rounded-none p-0 sm:top-1/2 sm:left-1/2 sm:h-[min(84vh,48rem)] sm:max-h-[min(84vh,48rem)] sm:w-[calc(100%-2rem)] sm:max-w-3xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl"
      data-homework-id={homework.id}
    >
      <Dialog.Header class="shrink-0 border-b px-6 py-5 pr-14 sm:px-10 sm:py-6">
        <Dialog.Title class="break-words text-xl font-semibold tracking-tight sm:text-2xl">
          {homework.title}
        </Dialog.Title>
        {#if contextLabel && contextHref}
          <Dialog.Description class="truncate text-sm sm:text-base">
            <a class="underline-offset-4 hover:underline" href={contextHref}>
              {contextLabel}
            </a>
          </Dialog.Description>
        {:else if contextLabel}
          <Dialog.Description class="truncate text-sm sm:text-base">
            {contextLabel}
          </Dialog.Description>
        {/if}
      </Dialog.Header>

      <ScrollArea class="h-0 min-h-0 flex-1">
        <div class="grid min-w-0 gap-6 px-6 py-6 sm:gap-8 sm:px-10 sm:py-8">
          {#if editing && editingContent}
            {@render editingContent()}
          {:else}
            <HomeworkDeadlineSummary
              {copy}
              {dateFallback}
              deadlineState={resolvedDeadlineState}
              {fmtDate}
              {homework}
              referenceDate={liveReferenceDate}
              {relativeEtaLabel}
            />
            <HomeworkDetailDescription {copy} {homework} />
            <HomeworkDetailSecondaryDetails {copy} {fmtDate} {homework} />
          {/if}

          {#if additionalContent}
            {@render additionalContent()}
          {/if}

          <HomeworkDetailDiscussion
            {CommentsPanel}
            {copy}
            {homework}
            {permalinkBaseHref}
          />
        </div>
      </ScrollArea>

      {#if showCompletion || (showContextActions && contextActions)}
        <Dialog.Footer class="mx-0 mb-0 shrink-0 rounded-none p-4 sm:rounded-b-xl sm:px-10 sm:py-5">
          <div class="flex w-full items-center justify-end gap-3">
            {#if showCompletion && onToggleCompletion}
              <Button
                class="order-1 min-h-11 min-w-0 flex-1 sm:order-2 sm:min-h-9 sm:flex-none"
                disabled={completionSaving}
                type="button"
                onclick={() => void onToggleCompletion?.()}
              >
                {#if homework.completed}
                  <RefreshCwIcon data-icon="inline-start" />
                  {completionSaving ? copy.saving : copy.markIncomplete}
                {:else}
                  <CheckCircleIcon data-icon="inline-start" />
                  {completionSaving ? copy.saving : copy.markComplete}
                {/if}
              </Button>
            {/if}
            {#if showContextActions && contextActions}
              <div class="order-2 shrink-0 sm:order-1">
                {@render contextActions()}
              </div>
            {/if}
          </div>
        </Dialog.Footer>
      {/if}
    </Dialog.Content>
  </Dialog.Root>
{/if}
