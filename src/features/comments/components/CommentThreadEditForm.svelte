<script lang="ts">
import type { CommentNode } from "@/features/comments/server/comment-types";
import { campusReferenceMarkdownPlugins } from "@/features/markdown/lib/campus-reference-markdown";
import MarkdownEditor from "$lib/components/MarkdownEditor.svelte";
import { Button } from "$lib/components/ui/button/index.js";
import { Checkbox } from "$lib/components/ui/checkbox/index.js";
import * as Field from "$lib/components/ui/field/index.js";
import * as NativeSelect from "$lib/components/ui/native-select/index.js";
import CommentAttachmentPills from "./CommentAttachmentPills.svelte";
import CommentUploadButton from "./CommentUploadButton.svelte";
import type {
  CommentSelectOption,
  CommentsCopy,
  CommentUploadOption,
  UploadsCopy,
} from "./comment-component-types";

export let cancelEdit: () => void;
export let comment: CommentNode;
export let commentCopy: CommentsCopy;
export let editAttachmentIds: string[];
export let editAttachmentOptions: (
  comment: CommentNode,
) => CommentUploadOption[];
export let editDraft: string;
export let editIsAnonymous: boolean;
export let editVisibility: string;
export let saveEdit: (comment: CommentNode) => void;
export let uploadCopy: UploadsCopy;
export let uploading: boolean;
export let uploadFile: (file: File, mode?: "edit" | "new" | "reply") => void;
export let visibilityOptions: CommentSelectOption[];

$: editAnonymousId = `comment-edit-anonymous-${comment.id}`;
$: editVisibilityId = `comment-edit-visibility-${comment.id}`;
$: editEditorLabelId = `comment-edit-editor-label-${comment.id}`;
</script>

<Field.Group class="gap-2">
  <span class="sr-only">{comment.body}</span>
  <Field.Group class="flex-row flex-wrap items-center justify-between gap-3 text-sm">
    <Field.Field orientation="horizontal" class="w-fit">
      <Checkbox id={editAnonymousId} bind:checked={editIsAnonymous} />
      <Field.Label for={editAnonymousId} class="font-normal">
        {commentCopy.visibilityAnonymous}
      </Field.Label>
    </Field.Field>
    <Field.Field class="w-auto">
      <Field.Label for={editVisibilityId} class="sr-only">
        {commentCopy.visibilityLabel}
      </Field.Label>
      <NativeSelect.Root
        aria-label={commentCopy.visibilityLabel}
        bind:value={editVisibility}
        class="min-w-32"
        id={editVisibilityId}
      >
        {#each visibilityOptions as option}
          <NativeSelect.Option value={option.value}>
            {option.label}
          </NativeSelect.Option>
        {/each}
      </NativeSelect.Root>
    </Field.Field>
  </Field.Group>
  <Field.Field>
    <Field.Title id={editEditorLabelId} class="sr-only">
      {commentCopy.markdownEditLabel}
    </Field.Title>
    <MarkdownEditor
      bind:value={editDraft}
      aria-labelledby={editEditorLabelId}
      compact
      guideLabel={commentCopy.markdownGuide}
      modeLabel={commentCopy.markdownModeLabel}
      placeholder={commentCopy.editorPlaceholder}
      previewEmptyLabel={commentCopy.previewEmpty}
      remarkPlugins={campusReferenceMarkdownPlugins}
      rows={4}
      tabPreviewLabel={commentCopy.tabPreview}
      tabWriteLabel={commentCopy.tabWrite}
    />
  </Field.Field>
  <CommentAttachmentPills
    files={editAttachmentOptions(comment)}
    removeLabel={commentCopy.removeAttachment}
    onRemove={(id) => {
      editAttachmentIds = editAttachmentIds.filter(
        (attachmentId) => attachmentId !== id,
      );
    }}
  />
  <div class="flex justify-end gap-2">
    <CommentUploadButton
      disabled={uploading}
      uploadLabel={uploadCopy.uploadAction}
      uploading={uploading}
      uploadingLabel={uploadCopy.uploading}
      onFile={(file) => {
        uploadFile(file, "edit");
      }}
    />
    <Button size="sm" type="button" variant="ghost" onclick={cancelEdit}>
      {commentCopy.cancelAction}
    </Button>
    <Button
      disabled={!editDraft.trim() || uploading}
      size="sm"
      type="button"
      onclick={() => saveEdit(comment)}
    >
      {commentCopy.saveAction}
    </Button>
  </div>
</Field.Group>
