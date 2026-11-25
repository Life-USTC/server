<script lang="ts">
import * as AlertDialog from "#lib/components/ui/alert-dialog/index.js";
import type { CommentsCopy } from "./comment-component-types";

export let close: () => void;
export let commentCopy: CommentsCopy;
export let deleteComment: () => void;
export let deleting: boolean;
export let error: string;
export let open: boolean;
</script>

{#if open}
  <AlertDialog.Root
    open={true}
    onOpenChange={(nextOpen) => {
      if (!nextOpen && !deleting) close();
    }}
  >
    <AlertDialog.Confirmation
      titleId="delete-comment-title"
      title={commentCopy.deleteConfirmTitle}
      description={commentCopy.deleteConfirmDescription}
      {error}
      cancelLabel={commentCopy.cancelAction}
      confirmLabel={commentCopy.deleteAction}
      pending={deleting}
      onclick={deleteComment}
    />
  </AlertDialog.Root>
{/if}
