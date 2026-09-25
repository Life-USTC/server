<script lang="ts">
import type {
  CommentNodeWithContext,
  CommentTargetOption,
} from "@/features/comments/lib/comment-ui";
import { campusReferenceMarkdownPlugins } from "@/features/markdown/lib/campus-reference-markdown";
import type { ViewerContext } from "@/lib/auth/viewer-context";
import MarkdownEditor from "$lib/components/MarkdownEditor.svelte";
import { Button } from "$lib/components/ui/button/index.js";
import * as Field from "$lib/components/ui/field/index.js";
import CommentAttachmentPills from "./CommentAttachmentPills.svelte";
import CommentAudienceFields from "./CommentAudienceFields.svelte";
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

let replyDisabled = true;

$: replyDisabled = !viewer.isAuthenticated || viewer.isSuspended;
$: replyDisabledAttr = replyDisabled ? "true" : undefined;
$: replyAnonymousId = `comment-reply-anonymous-${comment.id}`;
$: replyVisibilityId = `comment-reply-visibility-${comment.id}`;
$: replyEditorLabelId = `comment-reply-editor-label-${comment.id}`;
</script>

<Field.Group class="gap-3 p-4">
  <Field.Field data-disabled={replyDisabledAttr}>
    <Field.Title id={replyEditorLabelId} class="sr-only">
      {commentCopy.markdownReplyLabel}
    </Field.Title>
    <MarkdownEditor
      bind:value={replyDraft}
      aria-labelledby={replyEditorLabelId}
      compact
      disabled={replyDisabled}
      guideLabel={commentCopy.markdownGuide}
      modeLabel={commentCopy.markdownModeLabel}
      placeholder={commentCopy.replyPlaceholder}
      previewEmptyLabel={commentCopy.previewEmpty}
      remarkPlugins={campusReferenceMarkdownPlugins}
      rows={3}
      tabPreviewLabel={commentCopy.tabPreview}
      tabWriteLabel={commentCopy.tabWrite}
    />
  </Field.Field>
  <CommentAttachmentPills
    className="flex flex-wrap gap-2"
    files={replyUploadedFiles}
    removeLabel={commentCopy.removeAttachment}
    onRemove={removeReplyAttachment}
  />
  <Field.Group class="flex-row flex-wrap items-center gap-3">
    <CommentAudienceFields
      anonymousId={replyAnonymousId}
      visibilityId={replyVisibilityId}
      {commentCopy}
      bind:isAnonymous={replyIsAnonymous}
      bind:visibility={replyVisibility}
      {visibilityOptions}
      disabled={replyDisabled}
    />
  </Field.Group>
  <div class="flex justify-end gap-2">
    <CommentUploadButton
      disabled={replyDisabled || uploading}
      uploadLabel={uploadCopy.uploadAction}
      uploading={uploading}
      uploadingLabel={uploadCopy.uploading}
      onFile={(file) => {
        if (replyDisabled) return;
        uploadFile(file, "reply");
      }}
    />
    <Button type="button" variant="ghost" onclick={cancelReply}>{commentCopy.cancelAction}</Button>
    <Button
      disabled={!replyDraft.trim() || replyDisabled || submitting || uploading}
      type="button"
      onclick={() => {
        if (replyDisabled) return;
        submitComment(
          comment.id,
          replyDraft,
          commentTarget(comment),
        );
      }}
    >
      {commentCopy.postReply}
    </Button>
  </div>
</Field.Group>
