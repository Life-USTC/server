<script lang="ts">
import type { ViewerContext } from "@/lib/auth/viewer-context";
import CommentComposer from "./CommentComposer.svelte";
import CommentsPanelLoadingComposer from "./CommentsPanelLoadingComposer.svelte";
import type {
  CommentSelectOption,
  CommentsCopy,
  CommentUploadOption,
  UploadsCopy,
} from "./comment-component-types";

type CommentsComposerSectionProps = {
  appliedInitialData: boolean;
  body: string;
  commentCopy: CommentsCopy;
  handleEditorDrop: (event: DragEvent) => void;
  handleSubmitShortcut: (event: KeyboardEvent) => void;
  isAnonymous: boolean;
  isDragActive: boolean;
  loading: boolean;
  postTargetKey: string;
  postTargetOptions: CommentSelectOption[];
  removeAttachment: (uploadId: string) => void;
  signInHref: string;
  submitComment: () => void | Promise<void>;
  submitting: boolean;
  uploadCopy: UploadsCopy;
  uploadedFiles: CommentUploadOption[];
  uploadFile: (file: File) => void | Promise<void>;
  uploading: boolean;
  viewer: ViewerContext;
  visibility: string;
  visibilityOptions: CommentSelectOption[];
};

let {
  appliedInitialData,
  body = $bindable(),
  commentCopy,
  handleEditorDrop,
  handleSubmitShortcut,
  isAnonymous = $bindable(),
  isDragActive = $bindable(),
  loading,
  postTargetKey = $bindable(),
  postTargetOptions,
  removeAttachment,
  signInHref,
  submitComment,
  submitting,
  uploadCopy,
  uploadedFiles,
  uploadFile,
  uploading,
  viewer,
  visibility = $bindable(),
  visibilityOptions,
}: CommentsComposerSectionProps = $props();
</script>

{#if loading && !appliedInitialData}
  <CommentsPanelLoadingComposer />
{:else}
  <CommentComposer
    bind:body
    {commentCopy}
    {handleEditorDrop}
    {handleSubmitShortcut}
    bind:isAnonymous
    bind:isDragActive
    bind:postTargetKey
    {postTargetOptions}
    {removeAttachment}
    {signInHref}
    submitComment={() => {
      void submitComment();
    }}
    {submitting}
    {uploadCopy}
    {uploadedFiles}
    {uploading}
    uploadFile={(file) => {
      void uploadFile(file);
    }}
    {viewer}
    bind:visibility
    {visibilityOptions}
  />
{/if}
