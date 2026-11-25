<script lang="ts">
import * as AlertDialog from "#lib/components/ui/alert-dialog/index.js";
import { Spinner } from "#lib/components/ui/spinner/index.js";
import { enhance, type SubmitFunction } from "$app/forms";

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
      if (!open && !isDeleting) close();
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
        <div data-slot="alert-dialog-header">
          <AlertDialog.Title>{copy.deleteHomeworkTitle}</AlertDialog.Title>
          <AlertDialog.Description>
            {formatMessage(copy.deleteHomeworkDescription, { title: homework.title })}
          </AlertDialog.Description>
        </div>
        <div class="px-5 py-4">
          <input type="hidden" name="id" value={homework.id} />
          <p class="text-muted-foreground text-sm">
            {copy.deleteHomeworkAuditDescription}
          </p>
        </div>
        <div data-slot="alert-dialog-footer">
          <AlertDialog.Cancel disabled={isDeleting} type="button" variant="outline">
            {copy.cancelButton}
          </AlertDialog.Cancel>
          <AlertDialog.Action
            disabled={isDeleting}
            type="submit"
            variant="destructive"
          >
            {#if isDeleting}
              <Spinner data-icon="inline-start" />
            {/if}
            {isDeleting ? copy.saving : copy.deleteHomeworkAction}
          </AlertDialog.Action>
        </div>
      </form>
    </AlertDialog.Content>
  </AlertDialog.Root>
{/if}
