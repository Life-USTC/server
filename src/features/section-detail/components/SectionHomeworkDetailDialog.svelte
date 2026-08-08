<script lang="ts">
import type { Component } from "svelte";
import { commentTargetPermalinkBaseHref } from "@/features/comments/lib/comment-panel-controller";
import { Badge } from "$lib/components/ui/badge/index.js";
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
      class="max-w-6xl gap-0 overflow-hidden p-0 sm:max-w-6xl [&>[data-slot=dialog-close]]:top-4 [&>[data-slot=dialog-close]]:right-4"
    >
      <Dialog.Header class="border-b px-5 py-4 pr-14 sm:px-6 sm:py-5 sm:pr-16">
        <div class="grid min-w-0 gap-2">
          <div class="flex min-w-0 flex-wrap items-center gap-2">
            <Dialog.Title class="text-lg leading-tight">
              {_selectedHomework.title}
            </Dialog.Title>
            <Badge variant={_selectedHomework.completion ? "default" : "secondary"}>
              {_homeworkStatus(_selectedHomework)}
            </Badge>
          </div>
          <Dialog.Description>
            {_sectionCopy.due} · {_fmtDateTime(_selectedHomework.submissionDueAt)}
          </Dialog.Description>
        </div>
      </Dialog.Header>

      <ScrollArea class="h-[min(76vh,48rem)]">
        <div class="grid lg:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.8fr)]">
          <section class="grid min-w-0 content-start gap-5 p-5 sm:p-6">
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

          <aside class="min-w-0 border-t bg-muted/20 p-5 sm:p-6 lg:min-h-[34rem] lg:border-t-0 lg:border-l">
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
          </aside>
        </div>
      </ScrollArea>
    </Dialog.Content>
  </Dialog.Root>
{/if}
