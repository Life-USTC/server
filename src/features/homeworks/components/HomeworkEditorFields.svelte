<script lang="ts">
import * as Field from "#lib/components/ui/field/index.js";
import { buildHomeworkDueShortcuts } from "@/features/homeworks/lib/homework-due-shortcuts";
import HomeworkDescriptionFields from "./HomeworkDescriptionFields.svelte";
import HomeworkStyleGuide from "./HomeworkStyleGuide.svelte";
import HomeworkTagFields from "./HomeworkTagFields.svelte";
import HomeworkTimestampFields from "./HomeworkTimestampFields.svelte";
import HomeworkTitleField from "./HomeworkTitleField.svelte";
import type {
  HomeworkFormCommentsCopy,
  HomeworkFormCopy,
  HomeworkTagCopy,
  HomeworkTimestampActions,
  HomeworkTimestampCapabilities,
  HomeworkTimestampCopy,
} from "./homework-form-types";

type EditorCopy = HomeworkFormCopy & HomeworkTagCopy & HomeworkTimestampCopy;

export let actions: HomeworkTimestampActions = {};
export let advancedOpen = false;
export let capabilities: HomeworkTimestampCapabilities = {};
export let commentsCopy: HomeworkFormCommentsCopy;
export let copy: EditorCopy;
export let description = "";
export let disabled = false;
export let classStarts: string[] = [];
export let locale = "zh-cn";
export let idPrefix = "homework";
export let isMajor: boolean | undefined = undefined;
export let markdownModeLabel = "";
export let publishedAt = "";
export let requiresTeam: boolean | undefined = undefined;
export let styleGuidePrefix = idPrefix;
export let submissionDueAt = "";
export let submissionStartAt = "";
export let title = "";

const shortcutReferenceNow = new Date();
$: dueShortcuts = buildHomeworkDueShortcuts({
  classStarts,
  copy,
  locale,
  now: shortcutReferenceNow,
});
</script>

<Field.Group class="gap-4">
  <HomeworkTitleField {copy} {disabled} {idPrefix} {title} />
  <HomeworkTimestampFields
    {actions}
    {dueShortcuts}
    bind:advancedOpen
    {capabilities}
    {copy}
    {disabled}
    {idPrefix}
    bind:publishedAt
    bind:submissionDueAt
    bind:submissionStartAt
  >
    {#snippet details()}
      <HomeworkDescriptionFields
        {commentsCopy}
        {copy}
        {description}
        {disabled}
        {idPrefix}
        {markdownModeLabel}
      />
      <HomeworkTagFields
        {copy}
        {disabled}
        {idPrefix}
        {isMajor}
        {requiresTeam}
      />
    {/snippet}
  </HomeworkTimestampFields>
  <HomeworkStyleGuide {copy} testIdPrefix={styleGuidePrefix} />
</Field.Group>
