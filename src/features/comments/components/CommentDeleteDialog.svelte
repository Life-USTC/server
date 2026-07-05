<script lang="ts">
import * as AlertDialog from "$lib/components/ui/alert-dialog/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import type { CommentsCopy } from "./comment-component-types";

export let close: () => void;
export let commentCopy: CommentsCopy;
export let deleteComment: () => void;
export let open: boolean;
</script>

{#if open}
  <AlertDialog.Root
    open={true}
    onOpenChange={(nextOpen) => {
      if (!nextOpen) close();
    }}
  >
    <AlertDialog.Content
      class="max-w-md"
      aria-labelledby="delete-comment-title"
    >
      <AlertDialog.Header>
        <AlertDialog.Title id="delete-comment-title">{commentCopy.deleteConfirmTitle}</AlertDialog.Title>
        <AlertDialog.Description>{commentCopy.deleteConfirmDescription}</AlertDialog.Description>
      </AlertDialog.Header>
      <AlertDialog.Footer>
        <AlertDialog.Cancel type="button" variant="ghost">{commentCopy.cancelAction}</AlertDialog.Cancel>
        <Button type="button" variant="destructive" onclick={deleteComment}>
          {commentCopy.deleteAction}
        </Button>
      </AlertDialog.Footer>
    </AlertDialog.Content>
  </AlertDialog.Root>
{/if}
