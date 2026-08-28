<script lang="ts">
import HomeworkEditorFields from "@/features/homeworks/components/HomeworkEditorFields.svelte";
import * as Alert from "$lib/components/ui/alert/index.js";
import * as Field from "$lib/components/ui/field/index.js";
import * as NativeSelect from "$lib/components/ui/native-select/index.js";
import type {
  DashboardHomeworkCommentsCopy,
  DashboardHomeworkCreateCopy,
  DashboardHomeworkCreateSection,
  DashboardHomeworkCreateSectionGetter,
  DashboardHomeworkDateShortcut,
} from "./dashboard-homework-create-types";

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
$: homeworkTimestampActions = {
  dueAtSemesterEnd: applyHomeworkDueAtSemesterEnd,
  dueInMonth: applyHomeworkDueInMonth,
  dueInWeek: applyHomeworkDueInWeek,
  publishNow: () => {
    createHomeworkPublishedAt = toShanghaiDateTimeLocalValue(new Date());
  },
  startNow: applyHomeworkStartNow,
};
$: homeworkTimestampCapabilities = {
  hasSemesterEnd: Boolean(selectedCreateHomeworkSection()?.semesterEnd),
};
</script>

<Field.Group class="gap-5 px-5 py-4 sm:px-6 sm:py-5">
  {#if createHomeworkError}
    <Alert.Root variant="destructive">
      <Alert.Description>{createHomeworkError}</Alert.Description>
    </Alert.Root>
  {/if}
  <Field.Field
    class="rounded-lg bg-muted/40 p-3"
    data-disabled={isCreatingHomework ? "true" : undefined}
  >
    <Field.Label for="dashboard-homework-section">
      {homeworksCopy.sectionLabel}
    </Field.Label>
    <NativeSelect.Root
      bind:value={createHomeworkSectionId}
      disabled={isCreatingHomework}
      class="w-full"
      id="dashboard-homework-section"
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
  <HomeworkEditorFields
    actions={homeworkTimestampActions}
    bind:advancedOpen={createHomeworkAdvancedOpen}
    capabilities={homeworkTimestampCapabilities}
    commentsCopy={commentsCopy}
    copy={homeworksCopy}
    disabled={isCreatingHomework}
    idPrefix="dashboard-homework"
    markdownModeLabel={commentsCopy.markdownModeLabel}
    bind:publishedAt={createHomeworkPublishedAt}
    styleGuidePrefix="dashboard-homework"
    bind:submissionDueAt={createHomeworkSubmissionDueAt}
    bind:submissionStartAt={createHomeworkSubmissionStartAt}
  />
</Field.Group>
