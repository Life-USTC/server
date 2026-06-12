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

export let appliedInitialData: boolean;
export let body: string;
export let commentCopy: CommentsCopy;
export let handleEditorDrop: (event: DragEvent) => void;
export let handleSubmitShortcut: (event: KeyboardEvent) => void;
export let isAnonymous: boolean;
export let isDragActive: boolean;
export let loading: boolean;
export let postTargetKey: string;
export let postTargetOptions: CommentSelectOption[];
export let removeAttachment: (uploadId: string) => void;
export let signInHref: string;
export let submitComment: () => void | Promise<void>;
export let submitting: boolean;
export let uploadCopy: UploadsCopy;
export let uploadedFiles: CommentUploadOption[];
export let uploadFile: (file: File) => void | Promise<void>;
export let uploading: boolean;
export let viewer: ViewerContext;
export let visibility: string;
export let visibilityOptions: CommentSelectOption[];
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
