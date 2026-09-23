<script lang="ts">
import * as AlertDialog from "$lib/components/ui/alert-dialog/index.js";
import { Spinner } from "$lib/components/ui/spinner/index.js";
import type { CommentsCopy } from "./comment-component-types";

export let close: () => void;
export let commentCopy: CommentsCopy;
export let deleteComment: () => void;
export let deleting: boolean;
export let open: boolean;
</script>

{#if open}
  <AlertDialog.Root
    open={true}
    onOpenChange={(nextOpen) => {
      if (!nextOpen && !deleting) close();
    }}
  >
    <AlertDialog.Content
      class="max-w-md sm:max-w-md"
      aria-labelledby="delete-comment-title"
    >
      <AlertDialog.Header>
        <AlertDialog.Title id="delete-comment-title">{commentCopy.deleteConfirmTitle}</AlertDialog.Title>
        <AlertDialog.Description>{commentCopy.deleteConfirmDescription}</AlertDialog.Description>
      </AlertDialog.Header>
      <AlertDialog.Footer>
        <AlertDialog.Cancel disabled={deleting} type="button" variant="outline">
          {commentCopy.cancelAction}
        </AlertDialog.Cancel>
        <AlertDialog.Action
          disabled={deleting}
          type="button"
          variant="destructive"
          onclick={deleteComment}
        >
          {#if deleting}<Spinner data-icon="inline-start" />{/if}
          {commentCopy.deleteAction}
        </AlertDialog.Action>
      </AlertDialog.Footer>
    </AlertDialog.Content>
  </AlertDialog.Root>
{/if}
