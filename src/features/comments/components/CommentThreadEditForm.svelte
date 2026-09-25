<script lang="ts">
import type { CommentNode } from "@/features/comments/server/comment-types";
import { campusReferenceMarkdownPlugins } from "@/features/markdown/lib/campus-reference-markdown";
import MarkdownEditor from "$lib/components/MarkdownEditor.svelte";
import { Button } from "$lib/components/ui/button/index.js";
import * as Field from "$lib/components/ui/field/index.js";
import CommentAttachmentPills from "./CommentAttachmentPills.svelte";
import CommentAudienceFields from "./CommentAudienceFields.svelte";
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
  <Field.Group class="flex-row flex-wrap items-center justify-between gap-3">
    <CommentAudienceFields
      anonymousId={editAnonymousId}
      visibilityId={editVisibilityId}
      {commentCopy}
      bind:isAnonymous={editIsAnonymous}
      bind:visibility={editVisibility}
      {visibilityOptions}
    />
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
    <Button type="button" variant="ghost" onclick={cancelEdit}>
      {commentCopy.cancelAction}
    </Button>
    <Button
      disabled={!editDraft.trim() || uploading}
      type="button"
      onclick={() => saveEdit(comment)}
    >
      {commentCopy.saveAction}
    </Button>
  </div>
</Field.Group>
