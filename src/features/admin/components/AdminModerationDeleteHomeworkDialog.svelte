<script lang="ts">
import type { SubmitFunction } from "@sveltejs/kit";
import { enhance } from "$app/forms";
import { Button } from "$lib/components/ui/button/index.js";
import * as Dialog from "$lib/components/ui/dialog/index.js";

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
  <Dialog.Root
    open={true}
    class="max-w-md"
    onOpenChange={(open) => {
      if (!open) close();
    }}
  >
    <form
      method="POST"
      action="?/deleteHomework"
      use:enhance={enhanceDeleteHomework}
    >
      <Dialog.Header>
        <Dialog.Title>{copy.deleteHomeworkTitle}</Dialog.Title>
        <Dialog.Description>
          {formatMessage(copy.deleteHomeworkDescription, { title: homework.title })}
        </Dialog.Description>
      </Dialog.Header>
      <div class="px-5 py-4">
        <input type="hidden" name="id" value={homework.id} />
        <p class="text-base-content/60 text-sm">
          {copy.deleteHomeworkAuditDescription}
        </p>
      </div>
      <Dialog.Footer>
        <Button
          disabled={isDeleting}
          type="button"
          variant="ghost"
          onclick={close}
        >
          {copy.cancelButton}
        </Button>
        <Button
          class="border-error bg-error text-error-content hover:bg-error/90"
          disabled={isDeleting}
          type="submit"
        >
          {isDeleting ? copy.saving : copy.deleteHomeworkAction}
        </Button>
      </Dialog.Footer>
    </form>
  </Dialog.Root>
{/if}
