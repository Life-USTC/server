<script lang="ts">
import MarkdownEditor from "$lib/components/MarkdownEditor.svelte";
import { Alert } from "$lib/components/ui/alert/index.js";
import { Checkbox } from "$lib/components/ui/checkbox/index.js";
import { Input } from "$lib/components/ui/input/index.js";
import { Select } from "$lib/components/ui/select/index.js";
import type {
  DashboardHomeworkCommentsCopy,
  DashboardHomeworkCreateCopy,
  DashboardHomeworkCreateSection,
  DashboardHomeworkCreateSectionGetter,
  DashboardHomeworkDateShortcut,
} from "./dashboard-homework-create-types";
import HomeworkCreateScheduleFields from "./HomeworkCreateScheduleFields.svelte";

export let HOMEWORK_DESCRIPTION_MAX_LENGTH: number;
export let HOMEWORK_TITLE_MAX_LENGTH: number;
export let applyHomeworkDueAtSemesterEnd: DashboardHomeworkDateShortcut;
export let applyHomeworkDueInMonth: DashboardHomeworkDateShortcut;
export let applyHomeworkDueInWeek: DashboardHomeworkDateShortcut;
export let applyHomeworkStartNow: DashboardHomeworkDateShortcut;
export let commentsCopy: DashboardHomeworkCommentsCopy;
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
export let sections: DashboardHomeworkCreateSection[];
export let selectedCreateHomeworkSection: DashboardHomeworkCreateSectionGetter;
export let toShanghaiDateTimeLocalValue: (value: Date) => string;
</script>

<div class="grid gap-4 px-5 py-4">
  {#if createHomeworkError}
    <Alert variant="destructive">
      <span>{createHomeworkError}</span>
    </Alert>
  {/if}
  <label class="grid gap-2">
    <span class="font-medium text-sm">{homeworksCopy.sectionLabel}</span>
    <Select
      bind:value={createHomeworkSectionId}
      disabled={isCreatingHomework}
      items={sections.map((section) => ({
        value: String(section.id),
        label: homeworkSectionLabel(section),
      }))}
      name="sectionId"
      required
    />
  </label>
  <label class="grid gap-2">
    <span class="font-medium text-sm">{homeworksCopy.titleLabel}</span>
    <Input
      data-testid="dashboard-homework-title"
      disabled={isCreatingHomework}
      maxlength={HOMEWORK_TITLE_MAX_LENGTH}
      name="title"
      required
    />
  </label>
  <label class="grid gap-2">
    <span class="font-medium text-sm">{homeworksCopy.descriptionLabel}</span>
    <MarkdownEditor
      disabled={isCreatingHomework}
      guideLabel={commentsCopy.markdownGuide}
      maxlength={HOMEWORK_DESCRIPTION_MAX_LENGTH}
      modeLabel={commentsCopy.markdownModeLabel}
      name="description"
      placeholder={homeworksCopy.descriptionPlaceholder}
      previewEmptyLabel={commentsCopy.previewEmpty}
      tabPreviewLabel={commentsCopy.tabPreview}
      tabWriteLabel={commentsCopy.tabWrite}
    />
  </label>
  <HomeworkCreateScheduleFields
    {applyHomeworkDueAtSemesterEnd}
    {applyHomeworkDueInMonth}
    {applyHomeworkDueInWeek}
    {applyHomeworkStartNow}
    bind:createHomeworkAdvancedOpen
    bind:createHomeworkPublishedAt
    bind:createHomeworkSubmissionDueAt
    bind:createHomeworkSubmissionStartAt
    {homeworksCopy}
    {isCreatingHomework}
    {selectedCreateHomeworkSection}
    {toShanghaiDateTimeLocalValue}
  />
  <div class="flex flex-wrap gap-4">
    <label class="inline-flex items-center gap-2 text-sm">
      <Checkbox disabled={isCreatingHomework} name="isMajor" />
      <span>{homeworksCopy.tagMajor}</span>
    </label>
    <label class="inline-flex items-center gap-2 text-sm">
      <Checkbox disabled={isCreatingHomework} name="requiresTeam" />
      <span>{homeworksCopy.tagTeam}</span>
    </label>
  </div>
</div>
