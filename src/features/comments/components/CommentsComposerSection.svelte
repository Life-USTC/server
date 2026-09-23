<script lang="ts">
import type { ViewerContext } from "@/lib/auth/viewer-context";
import { Button } from "$lib/components/ui/button/index.js";
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
  /** When set, renders page-style h2 + primary action; collapsed trigger moves into that row. */
  heading?: string | null;
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
  heading = null,
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

let composerOpen = $state(false);

function closeComposer() {
  composerOpen = false;
}

function openComposer() {
  composerOpen = true;
}
</script>

{#if loading && !appliedInitialData}
  {#if heading}
    <div class="mb-3 flex flex-wrap items-center justify-between gap-3">
      <h2 class="text-lg font-semibold tracking-tight">{heading}</h2>
    </div>
  {/if}
  <CommentsPanelLoadingComposer />
{:else}
  {#if heading}
    <div class="mb-3 flex flex-wrap items-center justify-between gap-3">
      <h2 class="text-lg font-semibold tracking-tight">{heading}</h2>
      {#if composerOpen}
        <Button type="button" variant="outline" onclick={closeComposer}>
          {commentCopy.cancelAction}
        </Button>
      {:else if viewer.isAuthenticated}
        <Button type="button" variant="outline" onclick={openComposer}>
          {commentCopy.postAction}
        </Button>
      {:else}
        <Button href={signInHref} variant="outline">
          {commentCopy.loginToComment}
        </Button>
      {/if}
    </div>
  {:else if !composerOpen}
    <div class="flex justify-start">
      <Button type="button" variant="outline" onclick={openComposer}>
        {viewer.isAuthenticated ? commentCopy.postAction : commentCopy.loginToComment}
      </Button>
    </div>
  {/if}

  {#if composerOpen}
    <div class="grid gap-3">
      {#if !heading}
        <div class="flex justify-end">
          <Button type="button" variant="ghost" onclick={closeComposer}>
            {commentCopy.cancelAction}
          </Button>
        </div>
      {/if}
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
          void Promise.resolve(submitComment()).then(() => {
            if (!body.trim()) closeComposer();
          });
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
    </div>
  {/if}
{/if}
