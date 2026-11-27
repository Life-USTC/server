<script lang="ts">
import * as Alert from "#lib/components/ui/alert/index.js";
import * as Field from "#lib/components/ui/field/index.js";
import * as NativeSelect from "#lib/components/ui/native-select/index.js";
import HomeworkEditorFields from "@/features/homeworks/components/HomeworkEditorFields.svelte";
import type {
  HomeworkCreateCopy,
  HomeworkFormCommentsCopy,
} from "@/features/homeworks/components/homework-form-types";
import type { WorkspaceHomeworkCreateSection } from "./workspace-homework-create-types";

export let commentsCopy: HomeworkFormCommentsCopy & {
  markdownModeLabel: string;
};
export let createHomeworkAdvancedOpen: boolean;
export let createHomeworkError: string;
export let createHomeworkPublishedAt: string;
export let createHomeworkSectionId: string;
export let createHomeworkSubmissionDueAt: string;
export let createHomeworkSubmissionStartAt: string;
export let homeworkSectionLabel: (
  section: WorkspaceHomeworkCreateSection,
) => string;
export let homeworksCopy: HomeworkCreateCopy;
export let isCreatingHomework: boolean;
export let locale: string;
export let sections: WorkspaceHomeworkCreateSection[];

$: selectedSection = sections.find(
  (section) => String(section.id) === createHomeworkSectionId,
);
</script>

{#if createHomeworkError}
  <Alert.Message variant="destructive">{createHomeworkError}</Alert.Message>
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
    {#each sections as section}
      <option value={String(section.id)}>
        {homeworkSectionLabel(section)}
      </option>
    {/each}
  </NativeSelect.Root>
  {#if selectedSection}
    <Field.Description class="break-words">{homeworkSectionLabel(selectedSection)}</Field.Description>
  {/if}
</Field.Field>
<HomeworkEditorFields
  sectionJwId={selectedSection?.jwId}
  classStarts={selectedSection?.nextClassStarts ?? []}
  {locale}
  semester={{ start: selectedSection?.semesterStart, end: selectedSection?.semesterEnd, showStartShortcut: Boolean(selectedSection?.semesterStart) }}
  bind:advancedOpen={createHomeworkAdvancedOpen}
  {commentsCopy}
  copy={homeworksCopy}
  disabled={isCreatingHomework}
  idPrefix="workspace-homework"
  markdownModeLabel={commentsCopy.markdownModeLabel}
  bind:publishedAt={createHomeworkPublishedAt}
  bind:submissionDueAt={createHomeworkSubmissionDueAt}
  bind:submissionStartAt={createHomeworkSubmissionStartAt}
/>
