<script lang="ts">
import type { SubmitFunction } from "@sveltejs/kit";
import { enhance } from "$app/forms";
import * as AlertDialog from "$lib/components/ui/alert-dialog/index.js";
import { Button } from "$lib/components/ui/button/index.js";

type Homework = {
  id: string;
  title: string;
};

export let close: () => void;
export let copy: {
  cancelButton: string;
  deleteHomeworkAction: string;
  deleteHomeworkAuditDescription: string;
  deleteHomeworkDescription: string;
  deleteHomeworkTitle: string;
  saving: string;
};
export let enhanceDeleteHomework: SubmitFunction;
export let formatMessage: (
  template: string,
  values: Record<string, string>,
) => string;
export let homework: Homework | null;
export let isDeleting: boolean;
</script>

{#if homework}
  <AlertDialog.Root
    open={true}
    onOpenChange={(open) => {
      if (!open) close();
    }}
  >
    <AlertDialog.Content
      class="max-w-md sm:max-w-md"
    >
      <form
        method="POST"
        action="?/deleteHomework"
        use:enhance={enhanceDeleteHomework}
      >
        <AlertDialog.Header>
          <AlertDialog.Title>{copy.deleteHomeworkTitle}</AlertDialog.Title>
          <AlertDialog.Description>
            {formatMessage(copy.deleteHomeworkDescription, { title: homework.title })}
          </AlertDialog.Description>
        </AlertDialog.Header>
        <div class="px-5 py-4">
          <input type="hidden" name="id" value={homework.id} />
          <p class="text-base-content/60 text-sm">
            {copy.deleteHomeworkAuditDescription}
          </p>
        </div>
        <AlertDialog.Footer>
          <AlertDialog.Cancel
            disabled={isDeleting}
            type="button"
            variant="ghost"
          >
            {copy.cancelButton}
          </AlertDialog.Cancel>
          <Button
            disabled={isDeleting}
            type="submit"
            variant="destructive"
          >
            {isDeleting ? copy.saving : copy.deleteHomeworkAction}
          </Button>
        </AlertDialog.Footer>
      </form>
    </AlertDialog.Content>
  </AlertDialog.Root>
{/if}
