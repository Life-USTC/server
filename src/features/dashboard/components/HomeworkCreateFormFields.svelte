<script lang="ts">
import {
  HOMEWORK_DESCRIPTION_MAX_LENGTH,
  HOMEWORK_TITLE_MAX_LENGTH,
} from "@/features/homeworks/lib/homework-limits";
import { campusReferenceMarkdownPlugins } from "@/features/markdown/lib/campus-reference-markdown";
import MarkdownEditor from "$lib/components/MarkdownEditor.svelte";
import * as Alert from "$lib/components/ui/alert/index.js";
import { Checkbox } from "$lib/components/ui/checkbox/index.js";
import * as Field from "$lib/components/ui/field/index.js";
import { Input } from "$lib/components/ui/input/index.js";
import * as Select from "$lib/components/ui/select/index.js";
import type {
  DashboardHomeworkCommentsCopy,
  DashboardHomeworkCreateCopy,
  DashboardHomeworkCreateSection,
  DashboardHomeworkCreateSectionGetter,
  DashboardHomeworkDateShortcut,
} from "./dashboard-homework-create-types";
import HomeworkCreateScheduleFields from "./HomeworkCreateScheduleFields.svelte";

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

$: sectionOptions = sections.map((section) => ({
  value: String(section.id),
  label: homeworkSectionLabel(section),
}));
</script>

<div class="grid gap-4 px-5 py-4">
  {#if createHomeworkError}
    <Alert.Root variant="destructive">
      <Alert.Description>{createHomeworkError}</Alert.Description>
    </Alert.Root>
  {/if}
  <Field.Field>
    <Field.Label for="dashboard-homework-section">
      {homeworksCopy.sectionLabel}
    </Field.Label>
    <Select.Root
      bind:value={createHomeworkSectionId}
      disabled={isCreatingHomework}
      name="sectionId"
      required
      type="single"
    >
      <Select.Trigger id="dashboard-homework-section" class="w-full">
        {sectionOptions.find((option) => option.value === createHomeworkSectionId)
          ?.label ?? sectionOptions[0]?.label ?? ""}
      </Select.Trigger>
      <Select.Content>
        <Select.Group>
          {#each sectionOptions as option}
            <Select.Item label={option.label} value={option.value}>
              {option.label}
            </Select.Item>
          {/each}
        </Select.Group>
      </Select.Content>
    </Select.Root>
  </Field.Field>
  <Field.Field>
    <Field.Label for="dashboard-homework-title">
      {homeworksCopy.titleLabel}
    </Field.Label>
    <Input
      data-testid="dashboard-homework-title"
      id="dashboard-homework-title"
      disabled={isCreatingHomework}
      maxlength={HOMEWORK_TITLE_MAX_LENGTH}
      name="title"
      required
    />
  </Field.Field>
  <Field.Field>
    <Field.Title id="dashboard-homework-description-label">
      {homeworksCopy.descriptionLabel}
    </Field.Title>
    <MarkdownEditor
      aria-labelledby="dashboard-homework-description-label"
      disabled={isCreatingHomework}
      guideLabel={commentsCopy.markdownGuide}
      maxlength={HOMEWORK_DESCRIPTION_MAX_LENGTH}
      modeLabel={commentsCopy.markdownModeLabel}
      name="description"
      placeholder={homeworksCopy.descriptionPlaceholder}
      previewEmptyLabel={commentsCopy.previewEmpty}
      remarkPlugins={campusReferenceMarkdownPlugins}
      tabPreviewLabel={commentsCopy.tabPreview}
      tabWriteLabel={commentsCopy.tabWrite}
    />
  </Field.Field>
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
  <Field.Set>
    <Field.Legend variant="label" class="sr-only">
      {homeworksCopy.tagMajor} / {homeworksCopy.tagTeam}
    </Field.Legend>
    <Field.Group class="flex-row flex-wrap gap-4" data-slot="checkbox-group">
      <Field.Field class="w-fit" orientation="horizontal">
        <Checkbox
          disabled={isCreatingHomework}
          id="dashboard-homework-is-major"
          name="isMajor"
        />
        <Field.Label for="dashboard-homework-is-major" class="font-normal">
          {homeworksCopy.tagMajor}
        </Field.Label>
      </Field.Field>
      <Field.Field class="w-fit" orientation="horizontal">
        <Checkbox
          disabled={isCreatingHomework}
          id="dashboard-homework-requires-team"
          name="requiresTeam"
        />
        <Field.Label for="dashboard-homework-requires-team" class="font-normal">
          {homeworksCopy.tagTeam}
        </Field.Label>
      </Field.Field>
    </Field.Group>
  </Field.Set>
</div>
