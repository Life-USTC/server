<script lang="ts">
import type { ViewerContext } from "@/lib/auth/viewer-context";
import MarkdownEditor from "$lib/components/MarkdownEditor.svelte";
import * as Card from "$lib/components/ui/card/index.js";
import CommentAttachmentPills from "./CommentAttachmentPills.svelte";
import CommentComposerActions from "./CommentComposerActions.svelte";
import CommentComposerHeader from "./CommentComposerHeader.svelte";
import CommentComposerTargetSelect from "./CommentComposerTargetSelect.svelte";
import type {
  CommentSelectOption,
  CommentsCopy,
  CommentUploadOption,
  UploadsCopy,
} from "./comment-component-types";

export let body: string;
export let commentCopy: CommentsCopy;
export let handleEditorDrop: (event: DragEvent) => void;
export let handleSubmitShortcut: (event: KeyboardEvent) => void;
export let isAnonymous: boolean;
export let isDragActive: boolean;
export let postTargetKey: string;
export let postTargetOptions: CommentSelectOption[];
export let removeAttachment: (uploadId: string) => void;
export let signInHref: string;
export let submitComment: () => void;
export let submitting: boolean;
export let uploadCopy: UploadsCopy;
export let uploadedFiles: CommentUploadOption[];
export let uploading: boolean;
export let uploadFile: (file: File) => void;
export let viewer: ViewerContext;
export let visibility: string;
export let visibilityOptions: CommentSelectOption[];
</script>

<Card.Root>
  <CommentComposerHeader
    {commentCopy}
    bind:isAnonymous
    {viewer}
    bind:visibility
    {visibilityOptions}
  />
  <Card.Content class="grid gap-4">
    <CommentComposerTargetSelect
      {commentCopy}
      bind:postTargetKey
      {postTargetOptions}
      {viewer}
    />
    <MarkdownEditor
      bind:value={body}
      disabled={!viewer.isAuthenticated || viewer.isSuspended}
      guideLabel={commentCopy.markdownGuide}
      {isDragActive}
      modeLabel={commentCopy.markdownModeLabel}
      placeholder={viewer.isAuthenticated ? commentCopy.editorPlaceholder : commentCopy.loginToComment}
      previewEmptyLabel={commentCopy.previewEmpty}
      tabPreviewLabel={commentCopy.tabPreview}
      tabWriteLabel={commentCopy.tabWrite}
      ondragleave={() => {
        isDragActive = false;
      }}
      ondragover={(event: DragEvent) => {
        event.preventDefault();
        isDragActive = true;
      }}
      ondrop={handleEditorDrop}
      onkeydown={handleSubmitShortcut}
    />
    <CommentAttachmentPills
      files={uploadedFiles}
      removeLabel={commentCopy.removeAttachment}
      onRemove={removeAttachment}
    />
    <CommentComposerActions
      {body}
      {commentCopy}
      {signInHref}
      {submitComment}
      {submitting}
      {uploadCopy}
      {uploading}
      {uploadFile}
      {viewer}
    />
  </Card.Content>
</Card.Root>
