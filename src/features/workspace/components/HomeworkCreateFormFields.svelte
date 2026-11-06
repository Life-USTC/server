<script lang="ts">
import * as Alert from "#lib/components/ui/alert/index.js";
import * as Field from "#lib/components/ui/field/index.js";
import * as NativeSelect from "#lib/components/ui/native-select/index.js";
import HomeworkEditorFields from "@/features/homeworks/components/HomeworkEditorFields.svelte";
import {
  homeworkDueAtSemesterEnd,
  homeworkDueInDays,
  homeworkDueInMonths,
  homeworkStartAtSemesterStart,
} from "@/features/homeworks/lib/homework-timestamp-defaults";
import type {
  WorkspaceHomeworkCommentsCopy,
  WorkspaceHomeworkCreateCopy,
  WorkspaceHomeworkCreateSection,
  WorkspaceHomeworkDateShortcut,
} from "./workspace-homework-create-types";

export let applyHomeworkDueAtSemesterEnd: WorkspaceHomeworkDateShortcut;
export let applyHomeworkStartNow: WorkspaceHomeworkDateShortcut;
export let commentsCopy: WorkspaceHomeworkCommentsCopy;
export let createHomeworkAdvancedOpen: boolean;
export let createHomeworkError: string;
export let createHomeworkPublishedAt: string;
export let createHomeworkSectionId: string;
export let createHomeworkSubmissionDueAt: string;
export let createHomeworkSubmissionStartAt: string;
export let homeworkSectionLabel: (
  section: WorkspaceHomeworkCreateSection,
) => string;
export let homeworksCopy: WorkspaceHomeworkCreateCopy;
export let isCreatingHomework: boolean;
export let locale: string;
export let sections: WorkspaceHomeworkCreateSection[];
export let toShanghaiDateTimeLocalValue: (value: Date) => string;

const shortcutReferenceNow = new Date();
$: selectedSection = sections.find(
  (section) => String(section.id) === createHomeworkSectionId,
);

$: sectionOptions = sections.map((section) => ({
  value: String(section.id),
  label: homeworkSectionLabel(section),
}));
$: homeworkTimestampActions = {
  dueAtSemesterEnd: applyHomeworkDueAtSemesterEnd,
  dueInWeek: () => {
    createHomeworkSubmissionDueAt = homeworkDueInDays(7);
  },
  dueInMonth: () => {
    createHomeworkSubmissionDueAt = homeworkDueInMonths(1);
  },
  publishNow: () => {
    createHomeworkPublishedAt = toShanghaiDateTimeLocalValue(new Date());
  },
  startNow: applyHomeworkStartNow,
  startAtSemesterStart: selectedSection?.semesterStart
    ? () => {
        if (selectedSection?.semesterStart) {
          createHomeworkSubmissionStartAt = homeworkStartAtSemesterStart(
            selectedSection.semesterStart,
          );
        }
      }
    : undefined,
};
$: homeworkTimestampCapabilities = {
  hasSemesterStart: Boolean(selectedSection?.semesterStart),
  hasSemesterEnd: Boolean(
    selectedSection?.semesterEnd &&
      homeworkDueAtSemesterEnd(selectedSection.semesterEnd) >
        toShanghaiDateTimeLocalValue(shortcutReferenceNow),
  ),
};
</script>

<Field.Group class="min-w-0 gap-5 px-5 py-4 sm:px-6 sm:py-5">
  {#if createHomeworkError}
    <Alert.Root variant="destructive">
      <Alert.Description>{createHomeworkError}</Alert.Description>
    </Alert.Root>
  {/if}
  <Field.Field
    data-disabled={isCreatingHomework ? "true" : undefined}
  >
    <Field.Label for="workspace-homework-section">
      {homeworksCopy.sectionLabel}
    </Field.Label>
    <NativeSelect.Root
      bind:value={createHomeworkSectionId}
      disabled={isCreatingHomework}
      class="min-w-0 w-full max-w-full"
      id="workspace-homework-section"
      name="sectionId"
      required
    >
      {#each sectionOptions as option}
        <NativeSelect.Option value={option.value}>
          {option.label}
        </NativeSelect.Option>
      {/each}
    </NativeSelect.Root>
    {#if selectedSection}
      <Field.Description class="break-words">{homeworkSectionLabel(selectedSection)}</Field.Description>
    {/if}
  </Field.Field>
  <HomeworkEditorFields
    classStarts={selectedSection?.nextClassStarts ?? []}
    {locale}
    actions={homeworkTimestampActions}
    bind:advancedOpen={createHomeworkAdvancedOpen}
    capabilities={homeworkTimestampCapabilities}
    {commentsCopy}
    copy={homeworksCopy}
    disabled={isCreatingHomework}
    idPrefix="workspace-homework"
    markdownModeLabel={commentsCopy.markdownModeLabel}
    bind:publishedAt={createHomeworkPublishedAt}
    bind:submissionDueAt={createHomeworkSubmissionDueAt}
    bind:submissionStartAt={createHomeworkSubmissionStartAt}
  />
</Field.Group>
