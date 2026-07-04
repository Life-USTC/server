<script lang="ts">
import type {
  CommentNodeWithContext,
  CommentTargetOption,
} from "@/features/comments/lib/comment-ui";
import { campusReferenceMarkdownPlugins } from "@/features/markdown/lib/campus-reference-markdown";
import type { ViewerContext } from "@/lib/auth/viewer-context";
import MarkdownEditor from "$lib/components/MarkdownEditor.svelte";
import { Button } from "$lib/components/ui/button/index.js";
import { Checkbox } from "$lib/components/ui/checkbox/index.js";
import * as Field from "$lib/components/ui/field/index.js";
import * as Select from "$lib/components/ui/select/index.js";
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

let replyDisabled = true;

$: replyDisabled = !viewer.isAuthenticated || viewer.isSuspended;
$: replyDisabledAttr = replyDisabled ? "true" : undefined;
$: replyAnonymousId = `comment-reply-anonymous-${comment.id}`;
$: replyVisibilityId = `comment-reply-visibility-${comment.id}`;
$: replyEditorLabelId = `comment-reply-editor-label-${comment.id}`;
</script>

<Field.Group class="gap-3 rounded-md border border-dashed p-4">
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
  <Field.Group class="flex-row flex-wrap items-center gap-3 text-sm">
    <Field.Field
      data-disabled={replyDisabledAttr}
      orientation="horizontal"
      class="w-fit"
    >
      <Checkbox
        id={replyAnonymousId}
        bind:checked={replyIsAnonymous}
        disabled={replyDisabled}
      />
      <Field.Label for={replyAnonymousId} class="font-normal">
        {commentCopy.visibilityAnonymous}
      </Field.Label>
    </Field.Field>
    <Field.Field data-disabled={replyDisabledAttr} class="w-auto">
      <Field.Label for={replyVisibilityId} class="sr-only">
        {commentCopy.visibilityLabel}
      </Field.Label>
      <Select.Root
        bind:value={replyVisibility}
        disabled={replyDisabled}
        type="single"
      >
        <Select.Trigger
          id={replyVisibilityId}
          aria-label={commentCopy.visibilityLabel}
          class="min-w-32"
        >
          {visibilityOptions.find((option) => option.value === replyVisibility)
            ?.label ?? visibilityOptions[0]?.label ?? ""}
        </Select.Trigger>
        <Select.Content>
          <Select.Group>
            {#each visibilityOptions as option}
              <Select.Item label={option.label} value={option.value}>
                {option.label}
              </Select.Item>
            {/each}
          </Select.Group>
        </Select.Content>
      </Select.Root>
    </Field.Field>
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
    <Button size="sm" type="button" variant="ghost" onclick={cancelReply}>{commentCopy.cancelAction}</Button>
    <Button
      disabled={!replyDraft.trim() || replyDisabled || submitting || uploading}
      size="sm"
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
