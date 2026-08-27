<script lang="ts">
import HomeworkFormFields from "@/features/homeworks/components/HomeworkFormFields.svelte";
import HomeworkTagFields from "@/features/homeworks/components/HomeworkTagFields.svelte";
import HomeworkTimestampFields from "@/features/homeworks/components/HomeworkTimestampFields.svelte";
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

<Field.Group class="gap-4 px-5 py-4">
  {#if createHomeworkError}
    <Alert.Root variant="destructive">
      <Alert.Description>{createHomeworkError}</Alert.Description>
    </Alert.Root>
  {/if}
  <Field.Field data-disabled={isCreatingHomework ? "true" : undefined}>
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
  <HomeworkFormFields
    commentsCopy={commentsCopy}
    copy={homeworksCopy}
    disabled={isCreatingHomework}
    idPrefix="dashboard-homework"
    markdownModeLabel={commentsCopy.markdownModeLabel}
    styleGuidePrefix="dashboard-homework"
  />
  <HomeworkTimestampFields
    actions={homeworkTimestampActions}
    bind:advancedOpen={createHomeworkAdvancedOpen}
    capabilities={homeworkTimestampCapabilities}
    copy={homeworksCopy}
    disabled={isCreatingHomework}
    idPrefix="dashboard-homework"
    bind:publishedAt={createHomeworkPublishedAt}
    bind:submissionDueAt={createHomeworkSubmissionDueAt}
    bind:submissionStartAt={createHomeworkSubmissionStartAt}
  />
  <HomeworkTagFields
    copy={homeworksCopy}
    disabled={isCreatingHomework}
    idPrefix="dashboard-homework"
  />
</Field.Group>
