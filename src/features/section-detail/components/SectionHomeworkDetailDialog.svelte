<script lang="ts">
import type { Component } from "svelte";
import { commentTargetPermalinkBaseHref } from "@/features/comments/lib/comment-panel-controller";
import { Button } from "$lib/components/ui/button/index.js";
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
      class="max-w-5xl sm:max-w-5xl"
    >
      <Dialog.Header>
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <Dialog.Title>{_selectedHomework.title}</Dialog.Title>
            <Dialog.Description>
              {_sectionCopy.due} {_fmtDateTime(_selectedHomework.submissionDueAt)} · {_homeworkStatus(_selectedHomework)}
            </Dialog.Description>
          </div>
          <Button size="sm" type="button" variant="ghost" onclick={close}>
            {_sectionCopy.close}
          </Button>
        </div>
      </Dialog.Header>

      <ScrollArea class="h-[min(70vh,44rem)]">
        <div class="grid gap-5 px-5 py-4 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,26rem)]">
          <section class="grid gap-4">
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

            <SectionHomeworkAuditTrail
              commonCopy={_commonCopy}
              fmtDateTime={_fmtDateTime}
              formatMessage={_formatMessage}
              homeworkAuditActionLabel={_homeworkAuditActionLabel}
              homeworkCopy={_homeworkCopy}
              logs={_auditLogsForHomework(_selectedHomework.id)}
            />
          </section>

          <section class="min-w-0 border-base-300 border-t pt-4 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-5">
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
        </div>
      </ScrollArea>
    </Dialog.Content>
  </Dialog.Root>
{/if}
