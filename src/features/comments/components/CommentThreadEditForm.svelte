<script lang="ts">
import type { CommentNode } from "@/features/comments/server/comment-types";
import MarkdownEditor from "$lib/components/MarkdownEditor.svelte";
import { Button } from "$lib/components/ui/button/index.js";
import { Checkbox } from "$lib/components/ui/checkbox/index.js";
import { Select } from "$lib/components/ui/select/index.js";
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
</script>

<div class="grid gap-2">
  <span class="sr-only">{comment.body}</span>
  <div class="flex flex-wrap items-center justify-between gap-3 rounded-md border border-base-300 bg-base-100 px-3 py-2 text-sm">
    <label class="flex items-center gap-2">
      <Checkbox bind:checked={editIsAnonymous} />
      <span>{commentCopy.visibilityAnonymous}</span>
    </label>
    <Select bind:value={editVisibility} items={visibilityOptions} />
  </div>
  <MarkdownEditor
    bind:value={editDraft}
    compact
    guideLabel={commentCopy.markdownGuide}
    modeLabel={commentCopy.markdownModeLabel}
    placeholder={commentCopy.editorPlaceholder}
    previewEmptyLabel={commentCopy.previewEmpty}
    rows={4}
    tabPreviewLabel={commentCopy.tabPreview}
    tabWriteLabel={commentCopy.tabWrite}
  />
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
    <Button size="sm" type="button" onclick={() => saveEdit(comment)}>
      {commentCopy.saveAction}
    </Button>
  </div>
</div>
