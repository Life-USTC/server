<script lang="ts">
import * as Field from "$lib/components/ui/field/index.js";
import HomeworkDescriptionFields from "./HomeworkDescriptionFields.svelte";
import HomeworkTitleField from "./HomeworkTitleField.svelte";
import type {
  HomeworkFormCommentsCopy,
  HomeworkFormCopy,
} from "./homework-form-types";

export let commentsCopy: HomeworkFormCommentsCopy;
export let copy: HomeworkFormCopy;
export let description = "";
export let disabled = false;
export let idPrefix = "homework";
export let markdownModeLabel = "";
export let styleGuidePrefix = idPrefix;
export let title = "";
</script>

<Field.Group class="gap-4">
  <HomeworkTitleField {copy} {disabled} {idPrefix} {title} />
  <HomeworkDescriptionFields
    {commentsCopy}
    {copy}
    {description}
    {disabled}
    {idPrefix}
    {markdownModeLabel}
    {styleGuidePrefix}
  />
</Field.Group>
