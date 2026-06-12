<script lang="ts">
import { Button } from "$lib/components/ui/button/index.js";
import * as Dialog from "$lib/components/ui/dialog/index.js";
import type { CommentsCopy } from "./comment-component-types";

export let close: () => void;
export let commentCopy: CommentsCopy;
export let deleteComment: () => void;
export let open: boolean;
</script>

{#if open}
  <Dialog.Root
    open={true}
    class="max-w-md"
    role="alertdialog"
    aria-labelledby="delete-comment-title"
    onOpenChange={(nextOpen) => {
      if (!nextOpen) close();
    }}
  >
    <Dialog.Header>
      <Dialog.Title id="delete-comment-title">{commentCopy.deleteConfirmTitle}</Dialog.Title>
      <Dialog.Description>{commentCopy.deleteConfirmDescription}</Dialog.Description>
    </Dialog.Header>
    <Dialog.Footer>
      <Button type="button" variant="ghost" onclick={close}>{commentCopy.cancelAction}</Button>
      <Button type="button" variant="destructive" onclick={deleteComment}>
        {commentCopy.deleteAction}
      </Button>
    </Dialog.Footer>
  </Dialog.Root>
{/if}
