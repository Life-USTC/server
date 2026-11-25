<script lang="ts">
import * as Alert from "#lib/components/ui/alert/index.js";
import * as Field from "#lib/components/ui/field/index.js";
import HomeworkCreateDialog from "@/features/homeworks/components/HomeworkCreateDialog.svelte";
import HomeworkEditorFields from "@/features/homeworks/components/HomeworkEditorFields.svelte";
import type {
  HomeworkCreateCopy,
  HomeworkFormCommentsCopy,
  HomeworkSemesterDates,
} from "@/features/homeworks/components/homework-form-types";

export let semester: HomeworkSemesterDates;
export let classSectionJwId: number | string | null | undefined = undefined;
export let classStarts: string[] = [];
export let locale: string;
export let close: () => void;
export let commentsCopy: HomeworkFormCommentsCopy;
export let createHomework: (event: SubmitEvent) => void;
export let homeworkCopy: HomeworkCreateCopy;
export let homeworkMessage: string;
export let publishedAt: string;
export let sectionLabel: string;
export let show: boolean;
export let submissionDueAt: string;
export let submissionStartAt: string;
</script>

<HomeworkCreateDialog open={show} onClose={close} copy={homeworkCopy} onsubmit={createHomework}>
  <Field.Field class="rounded-lg bg-muted/40 p-3">
    <Field.Title>{homeworkCopy.sectionLabel}</Field.Title>
    <p class="text-sm font-medium">{sectionLabel}</p>
  </Field.Field>
  <HomeworkEditorFields
    sectionJwId={classSectionJwId}
    {classStarts}
    {locale}
    {semester}
    commentsCopy={commentsCopy}
    copy={homeworkCopy}
    idPrefix="section-homework"
    bind:publishedAt={publishedAt}
    styleGuidePrefix="section-create-homework"
    bind:submissionDueAt={submissionDueAt}
    bind:submissionStartAt={submissionStartAt}
  />
  {#if homeworkMessage}
    <Alert.Root variant="destructive">
      <Alert.Description>{homeworkMessage}</Alert.Description>
    </Alert.Root>
  {/if}
</HomeworkCreateDialog>
