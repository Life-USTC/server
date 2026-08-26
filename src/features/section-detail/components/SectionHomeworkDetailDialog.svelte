<script lang="ts">
import type { Component } from "svelte";
import { commentTargetPermalinkBaseHref } from "@/features/comments/lib/comment-panel-controller";
import * as Dialog from "$lib/components/ui/dialog/index.js";
import { ScrollArea } from "$lib/components/ui/scroll-area/index.js";
import SectionHomeworkActionBar from "./SectionHomeworkActionBar.svelte";
import SectionHomeworkAuditTrail from "./SectionHomeworkAuditTrail.svelte";
import SectionHomeworkEditForm from "./SectionHomeworkEditForm.svelte";
import SectionHomeworkReadOnlySummary from "./SectionHomeworkReadOnlySummary.svelte";
import type { FormatMessage } from "./section-detail-component-types";
import type {
  SectionHomeworkAction,
  SectionHomeworkAuditLookup,
  SectionHomeworkCommonCopy,
  SectionHomeworkCopy,
  SectionHomeworkDisplay,
  SectionHomeworkFormatter,
  SectionHomeworkMarkdownCopy,
  SectionHomeworkSectionCopy,
  SectionHomeworkSemesterDate,
  SectionHomeworkSubmitHandler,
  SectionHomeworkTimestampAction,
} from "./section-homework-display-types";

export let CommentsPanel: Component<{
  permalinkBaseHref?: string | null;
  targetId: string;
  targetType: "homework";
}>;
export let _applyEditDueAtSemesterEnd: SectionHomeworkTimestampAction;
export let _applyEditDueInMonth: SectionHomeworkTimestampAction;
export let _applyEditDueInWeek: SectionHomeworkTimestampAction;
export let _applyEditPublishNow: SectionHomeworkTimestampAction;
export let _applyEditStartAtSemesterStart: SectionHomeworkTimestampAction;
export let _applyEditStartNow: SectionHomeworkTimestampAction;
export let _auditLogsForHomework: SectionHomeworkAuditLookup;
export let _canManageSelectedHomework: boolean;
export let _canWriteHomework: boolean;
export let _cancelEditHomework: () => void;
export let _commentsCopy: SectionHomeworkMarkdownCopy;
export let _commonCopy: SectionHomeworkCommonCopy;
export let _editHomeworkMessage: string;
export let _editHomeworkPublishedAt: string;
export let _editHomeworkSubmissionDueAt: string;
export let _editHomeworkSubmissionStartAt: string;
export let _editingHomework: boolean;
export let _fmtDateTime: SectionHomeworkFormatter;
export let _formatMessage: FormatMessage;
export let _homeworkAuditActionLabel: (action: string) => string;
export let _homeworkCopy: SectionHomeworkCopy;
export let _homeworkStatus: (homework: SectionHomeworkDisplay) => string;
export let _sectionCopy: SectionHomeworkSectionCopy & { due: string };
export let _selectedHomework: SectionHomeworkDisplay | null;
export let _semesterDate: SectionHomeworkSemesterDate;
export let _setDeleteHomeworkTarget: SectionHomeworkAction;
export let _startEditHomework: () => void;
export let _toggleHomeworkCompletion: SectionHomeworkAction;
export let _updateHomework: SectionHomeworkSubmitHandler;
export let close: () => void;
export let sectionJwId: number | string;
</script>

{#if _selectedHomework}
  <Dialog.Root
    open={true}
    onOpenChange={(open) => {
      if (!open) close();
    }}
  >
    <Dialog.Content
      class="inset-0 flex h-dvh max-h-dvh w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-clip rounded-none p-0 sm:top-1/2 sm:left-1/2 sm:h-[min(68vh,40rem)] sm:max-h-[min(68vh,40rem)] sm:w-[calc(100%-2rem)] sm:max-w-3xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl"
    >
      <Dialog.Header class="shrink-0 border-b px-6 py-5 pr-14">
        <Dialog.Title class="break-words">{_selectedHomework.title}</Dialog.Title>
        <Dialog.Description>{_homeworkStatus(_selectedHomework)}</Dialog.Description>
      </Dialog.Header>

      <ScrollArea class="h-0 min-h-0 flex-1">
        <div class="grid min-w-0 gap-6 px-6 py-6">
          <section class="grid gap-6">
            {#if _editingHomework}
              <SectionHomeworkEditForm
                applyDueAtSemesterEnd={_applyEditDueAtSemesterEnd}
                applyDueInMonth={_applyEditDueInMonth}
                applyDueInWeek={_applyEditDueInWeek}
                applyPublishNow={_applyEditPublishNow}
                applyStartAtSemesterStart={_applyEditStartAtSemesterStart}
                applyStartNow={_applyEditStartNow}
                cancelEdit={_cancelEditHomework}
                commentsCopy={_commentsCopy}
                bind:editHomeworkMessage={_editHomeworkMessage}
                bind:editHomeworkPublishedAt={_editHomeworkPublishedAt}
                bind:editHomeworkSubmissionDueAt={_editHomeworkSubmissionDueAt}
                bind:editHomeworkSubmissionStartAt={_editHomeworkSubmissionStartAt}
                homework={_selectedHomework}
                homeworkCopy={_homeworkCopy}
                semesterDate={_semesterDate}
                updateHomework={_updateHomework}
              />
            {:else}
              <SectionHomeworkReadOnlySummary
                fmtDateTime={_fmtDateTime}
                homework={_selectedHomework}
                homeworkCopy={_homeworkCopy}
              />
            {/if}

          </section>

          <section class="min-w-0 border-t pt-6">
            {#key `comments:homework:${_selectedHomework.id}`}
              <CommentsPanel
                permalinkBaseHref={commentTargetPermalinkBaseHref({
                  homeworkId: _selectedHomework.id,
                  sectionJwId,
                  type: "homework",
                })}
                targetType="homework"
                targetId={_selectedHomework.id}
              />
            {/key}
          </section>

          <SectionHomeworkAuditTrail
            commonCopy={_commonCopy}
            fmtDateTime={_fmtDateTime}
            formatMessage={_formatMessage}
            homeworkAuditActionLabel={_homeworkAuditActionLabel}
            homeworkCopy={_homeworkCopy}
            logs={_auditLogsForHomework(_selectedHomework.id)}
          />
        </div>
      </ScrollArea>
      {#if _canWriteHomework || _canManageSelectedHomework}
        <Dialog.Footer class="mx-0 mb-0 shrink-0 rounded-none p-4 sm:rounded-b-xl sm:px-6">
          <SectionHomeworkActionBar
            canManage={_canManageSelectedHomework}
            canWrite={_canWriteHomework}
            cancelEdit={_cancelEditHomework}
            editing={_editingHomework}
            homework={_selectedHomework}
            homeworkCopy={_homeworkCopy}
            sectionCopy={_sectionCopy}
            setDeleteHomeworkTarget={_setDeleteHomeworkTarget}
            startEdit={_startEditHomework}
            toggleHomeworkCompletion={_toggleHomeworkCompletion}
          />
        </Dialog.Footer>
      {/if}
    </Dialog.Content>
  </Dialog.Root>
{/if}
