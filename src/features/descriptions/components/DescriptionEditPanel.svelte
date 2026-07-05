<script lang="ts">
import { campusReferenceMarkdownPlugins } from "@/features/markdown/lib/campus-reference-markdown";
import MarkdownEditor from "$lib/components/MarkdownEditor.svelte";
import { Button } from "$lib/components/ui/button/index.js";
import * as Field from "$lib/components/ui/field/index.js";

export let cancelEdit: () => void;
export let copy: {
  cancel: string;
  editorPlaceholder: string;
  markdownGuide: string;
  previewEmpty: string;
  save: string;
  saving: string;
  tabPreview: string;
  tabWrite: string;
  title: string;
};
export let draft: string;
export let isDisabled: boolean;
export let isSaving: boolean;
export let saveDescription: () => void;
</script>

<Field.Group class="gap-3">
  <Field.Field>
    <Field.Title id="description-edit-title">{copy.title}</Field.Title>
    <MarkdownEditor
      bind:value={draft}
      aria-labelledby="description-edit-title"
      disabled={isDisabled}
      guideLabel={copy.markdownGuide}
      modeLabel={copy.title}
      placeholder={copy.editorPlaceholder}
      previewEmptyLabel={copy.previewEmpty}
      remarkPlugins={campusReferenceMarkdownPlugins}
      tabPreviewLabel={copy.tabPreview}
      tabWriteLabel={copy.tabWrite}
    />
  </Field.Field>
  <div class="flex flex-wrap justify-end gap-2">
    <Button
      disabled={isSaving}
      size="sm"
      type="button"
      onclick={saveDescription}
    >
      {isSaving ? copy.saving : copy.save}
    </Button>
    <Button size="sm" type="button" variant="outline" onclick={cancelEdit}>
      {copy.cancel}
    </Button>
  </div>
</Field.Group>
