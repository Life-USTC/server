<script lang="ts">
import HomeworkDescriptionFields from "@/features/homeworks/components/HomeworkDescriptionFields.svelte";
import HomeworkTagFields from "@/features/homeworks/components/HomeworkTagFields.svelte";
import HomeworkTimestampFields from "@/features/homeworks/components/HomeworkTimestampFields.svelte";
import HomeworkTitleField from "@/features/homeworks/components/HomeworkTitleField.svelte";
import { buildHomeworkDueShortcuts } from "@/features/homeworks/lib/homework-due-shortcuts";
import { homeworkDueAtSemesterEnd } from "@/features/homeworks/lib/homework-timestamp-defaults";
import * as Alert from "$lib/components/ui/alert/index.js";
import * as Field from "$lib/components/ui/field/index.js";
import * as NativeSelect from "$lib/components/ui/native-select/index.js";
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
$: dueShortcuts = buildHomeworkDueShortcuts({
  classStarts: selectedSection?.nextClassStarts,
  copy: homeworksCopy,
  locale,
  now: shortcutReferenceNow,
});

$: sectionOptions = sections.map((section) => ({
  value: String(section.id),
  label: homeworkSectionLabel(section),
}));
$: homeworkTimestampActions = {
  dueAtSemesterEnd: applyHomeworkDueAtSemesterEnd,
  publishNow: () => {
    createHomeworkPublishedAt = toShanghaiDateTimeLocalValue(new Date());
  },
  startNow: applyHomeworkStartNow,
};
$: homeworkTimestampCapabilities = {
  hasSemesterEnd: Boolean(
    selectedSection?.semesterEnd &&
      homeworkDueAtSemesterEnd(selectedSection.semesterEnd) >
        toShanghaiDateTimeLocalValue(shortcutReferenceNow),
  ),
};
</script>

<Field.Group class="grid min-w-0 gap-6 px-5 py-4 sm:px-6 sm:py-5 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
  {#if createHomeworkError}
    <Alert.Root class="lg:col-span-2" variant="destructive">
      <Alert.Description>{createHomeworkError}</Alert.Description>
    </Alert.Root>
  {/if}
  <Field.Group class="min-w-0 gap-4">
  <Field.Field
    class="rounded-lg bg-muted/40 p-3"
    data-disabled={isCreatingHomework ? "true" : undefined}
  >
    <Field.Label for="workspace-homework-section">
      {homeworksCopy.sectionLabel}
    </Field.Label>
    <NativeSelect.Root
      bind:value={createHomeworkSectionId}
      disabled={isCreatingHomework}
      class="w-full"
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
  </Field.Field>
    <HomeworkTitleField copy={homeworksCopy} disabled={isCreatingHomework} idPrefix="workspace-homework" />
    <HomeworkTimestampFields
      {dueShortcuts}
      actions={homeworkTimestampActions}
      bind:advancedOpen={createHomeworkAdvancedOpen}
      capabilities={homeworkTimestampCapabilities}
      copy={homeworksCopy}
      disabled={isCreatingHomework}
      idPrefix="workspace-homework"
      bind:publishedAt={createHomeworkPublishedAt}
      bind:submissionDueAt={createHomeworkSubmissionDueAt}
      bind:submissionStartAt={createHomeworkSubmissionStartAt}
    >
      {#snippet optionalSettings()}
        <HomeworkTagFields copy={homeworksCopy} disabled={isCreatingHomework} idPrefix="workspace-homework" />
      {/snippet}
    </HomeworkTimestampFields>
  </Field.Group>
  <Field.Group class="min-w-0 gap-4">
    <HomeworkDescriptionFields
      {commentsCopy}
      copy={homeworksCopy}
      disabled={isCreatingHomework}
      idPrefix="workspace-homework"
      markdownModeLabel={commentsCopy.markdownModeLabel}
      previewLayout="split"
      styleGuidePrefix="workspace-homework"
    />
  </Field.Group>
</Field.Group>
