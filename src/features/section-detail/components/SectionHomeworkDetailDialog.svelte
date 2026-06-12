<script lang="ts">
import type { Component } from "svelte";
import { Button } from "$lib/components/ui/button/index.js";
import * as Dialog from "$lib/components/ui/dialog/index.js";
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
  targetId: string;
  targetType: "homework";
}>;
export let HOMEWORK_DESCRIPTION_MAX_LENGTH: number;
export let HOMEWORK_TITLE_MAX_LENGTH: number;
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
</script>

{#if _selectedHomework}
  <Dialog.Root
    open={true}
    class="max-w-5xl"
    onOpenChange={(open) => {
      if (!open) close();
    }}
  >
    <section class="grid max-h-[calc(100vh-2rem)] gap-4 overflow-y-auto">
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
              descriptionMaxLength={HOMEWORK_DESCRIPTION_MAX_LENGTH}
              bind:editHomeworkMessage={_editHomeworkMessage}
              bind:editHomeworkPublishedAt={_editHomeworkPublishedAt}
              bind:editHomeworkSubmissionDueAt={_editHomeworkSubmissionDueAt}
              bind:editHomeworkSubmissionStartAt={_editHomeworkSubmissionStartAt}
              homework={_selectedHomework}
              homeworkCopy={_homeworkCopy}
              semesterDate={_semesterDate}
              titleMaxLength={HOMEWORK_TITLE_MAX_LENGTH}
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
          <CommentsPanel targetType="homework" targetId={_selectedHomework.id} />
        </section>
      </div>
    </section>
  </Dialog.Root>
{/if}
