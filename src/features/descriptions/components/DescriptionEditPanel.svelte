<script lang="ts">
import MarkdownEditor from "$lib/components/MarkdownEditor.svelte";
import { Button } from "$lib/components/ui/button/index.js";

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

<div class="grid gap-3">
  <MarkdownEditor
    bind:value={draft}
    disabled={isDisabled}
    guideLabel={copy.markdownGuide}
    modeLabel={copy.title}
    placeholder={copy.editorPlaceholder}
    previewEmptyLabel={copy.previewEmpty}
    tabPreviewLabel={copy.tabPreview}
    tabWriteLabel={copy.tabWrite}
  />
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
</div>
