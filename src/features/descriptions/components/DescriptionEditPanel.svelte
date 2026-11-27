<script lang="ts">
import MarkdownEditor from "#lib/components/MarkdownEditor.svelte";
import { Button } from "#lib/components/ui/button/index.js";
import * as Field from "#lib/components/ui/field/index.js";
import { campusReferenceMarkdownPlugins } from "@/features/markdown/lib/campus-reference-markdown";
import type { DescriptionCopy } from "./description-component-types";

export let cancelEdit: () => void;
export let copy: DescriptionCopy;
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
      {copy}
      modeLabel={copy.title}
      placeholder={copy.editorPlaceholder}
      remarkPlugins={campusReferenceMarkdownPlugins}
    />
  </Field.Field>
  <div class="flex flex-wrap justify-end gap-2">
    <Button variant="outline" onclick={cancelEdit}>
      {copy.cancel}
    </Button>
    <Button
      disabled={isSaving || isDisabled}
      onclick={saveDescription}
    >
      {isSaving ? copy.saving : copy.save}
    </Button>
  </div>
</Field.Group>
