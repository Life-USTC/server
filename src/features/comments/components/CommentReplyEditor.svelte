<script lang="ts">
import type {
  CommentNodeWithContext,
  CommentTargetOption,
} from "@/features/comments/lib/comment-ui";
import type { ViewerContext } from "@/lib/auth/viewer-context";
import MarkdownEditor from "$lib/components/MarkdownEditor.svelte";
import { Button } from "$lib/components/ui/button/index.js";
import { Checkbox } from "$lib/components/ui/checkbox/index.js";
import { Select } from "$lib/components/ui/select/index.js";
import CommentAttachmentPills from "./CommentAttachmentPills.svelte";
import CommentUploadButton from "./CommentUploadButton.svelte";
import type {
  CommentSelectOption,
  CommentsCopy,
  CommentThreadProps,
  CommentUploadOption,
  UploadsCopy,
} from "./comment-component-types";

export let cancelReply: () => void;
export let comment: CommentNodeWithContext;
export let commentCopy: CommentsCopy;
export let commentTarget: (
  comment: CommentNodeWithContext,
) => CommentTargetOption | null;
export let removeReplyAttachment: (uploadId: string) => void;
export let replyDraft: string;
export let replyIsAnonymous: boolean;
export let replyUploadedFiles: CommentUploadOption[];
export let replyVisibility: string;
export let submitting: boolean;
export let submitComment: CommentThreadProps["submitComment"];
export let uploadCopy: UploadsCopy;
export let uploading: boolean;
export let uploadFile: (file: File, mode?: "edit" | "new" | "reply") => void;
export let visibilityOptions: CommentSelectOption[];
export let viewer: ViewerContext;
</script>

<div class="rounded-2xl border border-dashed border-base-300 bg-base-200/40 p-4">
  <MarkdownEditor
    bind:value={replyDraft}
    compact
    guideLabel={commentCopy.markdownGuide}
    modeLabel={commentCopy.markdownModeLabel}
    placeholder={commentCopy.replyPlaceholder}
    previewEmptyLabel={commentCopy.previewEmpty}
    rows={3}
    tabPreviewLabel={commentCopy.tabPreview}
    tabWriteLabel={commentCopy.tabWrite}
  />
  <CommentAttachmentPills
    className="mt-2 flex flex-wrap gap-2"
    files={replyUploadedFiles}
    removeLabel={commentCopy.removeAttachment}
    onRemove={removeReplyAttachment}
  />
  <div class="mt-3 flex flex-wrap items-center gap-3 text-sm">
    <label class="flex items-center gap-2">
      <Checkbox bind:checked={replyIsAnonymous} disabled={!viewer.isAuthenticated || viewer.isSuspended} />
      <span>{commentCopy.visibilityAnonymous}</span>
    </label>
    <Select
      bind:value={replyVisibility}
      disabled={!viewer.isAuthenticated || viewer.isSuspended}
      items={visibilityOptions}
    />
  </div>
  <div class="mt-2 flex justify-end gap-2">
    <CommentUploadButton
      disabled={uploading}
      uploadLabel={uploadCopy.uploadAction}
      uploading={uploading}
      uploadingLabel={uploadCopy.uploading}
      onFile={(file) => {
        uploadFile(file, "reply");
      }}
    />
    <Button size="sm" type="button" variant="ghost" onclick={cancelReply}>{commentCopy.cancelAction}</Button>
    <Button
      disabled={!replyDraft.trim() || submitting}
      size="sm"
      type="button"
      onclick={() =>
        submitComment(
          comment.id,
          replyDraft,
          commentTarget(comment),
        )}
    >
      {commentCopy.postReply}
    </Button>
  </div>
</div>
