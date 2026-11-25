<script lang="ts">
import * as Alert from "#lib/components/ui/alert/index.js";
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
    <AlertDialog.Content
      class="max-w-md sm:max-w-md"
      aria-labelledby="delete-comment-title"
    >
      <AlertDialog.Heading
        titleId="delete-comment-title"
        title={commentCopy.deleteConfirmTitle}
        description={commentCopy.deleteConfirmDescription}
      />
      {#if error}
        <Alert.Root variant="destructive"><Alert.Description>{error}</Alert.Description></Alert.Root>
      {/if}
      <AlertDialog.Actions
        cancelLabel={commentCopy.cancelAction}
        confirmLabel={commentCopy.deleteAction}
        pending={deleting}
        onclick={deleteComment}
      />
    </AlertDialog.Content>
  </AlertDialog.Root>
{/if}
