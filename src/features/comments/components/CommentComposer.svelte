<script lang="ts">
import { campusReferenceMarkdownPlugins } from "@/features/markdown/lib/campus-reference-markdown";
import type { ViewerContext } from "@/lib/auth/viewer-context";
import MarkdownEditor from "$lib/components/MarkdownEditor.svelte";
import * as Card from "$lib/components/ui/card/index.js";
import * as Field from "$lib/components/ui/field/index.js";
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

type CommentComposerProps = {
  body: string;
  commentCopy: CommentsCopy;
  handleEditorDrop: (event: DragEvent) => void;
  handleSubmitShortcut: (event: KeyboardEvent) => void;
  isAnonymous: boolean;
  isDragActive: boolean;
  postTargetKey: string;
  postTargetOptions: CommentSelectOption[];
  removeAttachment: (uploadId: string) => void;
  signInHref: string;
  submitComment: () => void;
  submitting: boolean;
  uploadCopy: UploadsCopy;
  uploadedFiles: CommentUploadOption[];
  uploading: boolean;
  uploadFile: (file: File) => void;
  viewer: ViewerContext;
  visibility: string;
  visibilityOptions: CommentSelectOption[];
};

let {
  body = $bindable(),
  commentCopy,
  handleEditorDrop,
  handleSubmitShortcut,
  isAnonymous = $bindable(),
  isDragActive = $bindable(),
  postTargetKey = $bindable(),
  postTargetOptions,
  removeAttachment,
  signInHref,
  submitComment,
  submitting,
  uploadCopy,
  uploadedFiles,
  uploading,
  uploadFile,
  viewer,
  visibility = $bindable(),
  visibilityOptions,
}: CommentComposerProps = $props();

const composerEditorLabelId = "comment-composer-editor-label";

let composerDisabled = $derived(!viewer.isAuthenticated || viewer.isSuspended);
let composerDisabledAttr = $derived(composerDisabled ? "true" : undefined);
</script>

<Card.Root>
  <CommentComposerHeader
    {commentCopy}
    bind:isAnonymous
    {viewer}
    bind:visibility
    {visibilityOptions}
  />
  <Card.Content>
    <Field.Group>
      <CommentComposerTargetSelect
        {commentCopy}
        bind:postTargetKey
        {postTargetOptions}
        {viewer}
      />
      <Field.Field data-disabled={composerDisabledAttr}>
        <Field.Title id={composerEditorLabelId} class="sr-only">
          {commentCopy.markdownCommentLabel}
        </Field.Title>
        <MarkdownEditor
          bind:value={body}
          aria-labelledby={composerEditorLabelId}
          disabled={composerDisabled}
          guideLabel={commentCopy.markdownGuide}
          {isDragActive}
          modeLabel={commentCopy.markdownModeLabel}
          placeholder={viewer.isAuthenticated
            ? commentCopy.editorPlaceholder
            : commentCopy.loginToComment}
          previewEmptyLabel={commentCopy.previewEmpty}
          remarkPlugins={campusReferenceMarkdownPlugins}
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
      </Field.Field>
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
    </Field.Group>
  </Card.Content>
</Card.Root>
