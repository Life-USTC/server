<script lang="ts">
import type { ViewerContext } from "@/lib/auth/viewer-context";
import { Button } from "$lib/components/ui/button/index.js";
import CommentUploadButton from "./CommentUploadButton.svelte";
import type { CommentsCopy, UploadsCopy } from "./comment-component-types";

export let body: string;
export let commentCopy: CommentsCopy;
export let signInHref: string;
export let submitComment: () => void;
export let submitting: boolean;
export let uploadCopy: UploadsCopy;
export let uploading: boolean;
export let uploadFile: (file: File) => void;
export let viewer: ViewerContext;
</script>

<div class="flex flex-wrap items-center gap-2">
  {#if !viewer.isAuthenticated}
    <Button href={signInHref} size="sm" variant="outline">
      {commentCopy.loginToComment}
    </Button>
  {/if}
  <CommentUploadButton
    disabled={!viewer.isAuthenticated || viewer.isSuspended || uploading}
    uploadLabel={uploadCopy.uploadAction}
    uploading={uploading}
    uploadingLabel={uploadCopy.uploading}
    onFile={(file) => {
      uploadFile(file);
    }}
  />
  <Button
    class="ml-auto"
    disabled={!body.trim() || !viewer.isAuthenticated || viewer.isSuspended || submitting}
    size="sm"
    type="button"
    onclick={submitComment}
  >
    {submitting ? commentCopy.posting : commentCopy.postAction}
  </Button>
</div>
