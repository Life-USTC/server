<script lang="ts">
import {
  HOMEWORK_DESCRIPTION_MAX_LENGTH,
  HOMEWORK_TITLE_MAX_LENGTH,
} from "@/features/homeworks/lib/homework-limits";
import { campusReferenceMarkdownPlugins } from "@/features/markdown/lib/campus-reference-markdown";
import MarkdownEditor from "$lib/components/MarkdownEditor.svelte";
import * as Field from "$lib/components/ui/field/index.js";
import { Input } from "$lib/components/ui/input/index.js";
import HomeworkStyleGuide from "./HomeworkStyleGuide.svelte";
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
  <Field.Field data-disabled={disabled ? "true" : undefined}>
    <Field.Label for={`${idPrefix}-title`}>{copy.titleLabel}</Field.Label>
    <Input
      data-testid={`${idPrefix}-title`}
      disabled={disabled}
      id={`${idPrefix}-title`}
      maxlength={HOMEWORK_TITLE_MAX_LENGTH}
      name="title"
      placeholder={copy.titlePlaceholder}
      required
      value={title}
    />
  </Field.Field>
  <HomeworkStyleGuide {copy} testIdPrefix={styleGuidePrefix} />
  <Field.Field data-disabled={disabled ? "true" : undefined}>
    <Field.Title id={`${idPrefix}-description-label`}>
      {copy.descriptionLabel}
    </Field.Title>
    <MarkdownEditor
      aria-labelledby={`${idPrefix}-description-label`}
      disabled={disabled}
      guideLabel={commentsCopy.markdownGuide}
      maxlength={HOMEWORK_DESCRIPTION_MAX_LENGTH}
      modeLabel={markdownModeLabel || copy.descriptionLabel}
      name="description"
      placeholder={copy.descriptionPlaceholder}
      previewEmptyLabel={commentsCopy.previewEmpty}
      remarkPlugins={campusReferenceMarkdownPlugins}
      tabPreviewLabel={commentsCopy.tabPreview}
      tabWriteLabel={commentsCopy.tabWrite}
      value={description}
    />
  </Field.Field>
</Field.Group>
