<script lang="ts">
import * as AlertDialog from "$lib/components/ui/alert-dialog/index.js";
import { Spinner } from "$lib/components/ui/spinner/index.js";

type HomeworkTarget = {
  title: string;
};

export let formatMessage: (
  template: string,
  values: Record<string, string>,
) => string;
export let homeworkCopy: {
  cancel: string;
  deleteAction: string;
  deleteDescription: string;
  deleteTitle: string;
};
export let onCancel: () => void;
export let onConfirm: () => void | Promise<void>;
export let target: HomeworkTarget;

let pending = false;

async function confirmDelete(event: MouseEvent) {
  event.preventDefault();
  if (pending) return;
  pending = true;
  try {
    await onConfirm();
  } finally {
    pending = false;
  }
}
</script>

<AlertDialog.Root
  open={true}
  onOpenChange={(open) => {
    if (!open) onCancel();
  }}
>
  <AlertDialog.Content
    class="max-w-md sm:max-w-md"
  >
    <AlertDialog.Header>
      <AlertDialog.Title>{homeworkCopy.deleteTitle}</AlertDialog.Title>
      <AlertDialog.Description>
        {formatMessage(homeworkCopy.deleteDescription, { title: target.title })}
      </AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel disabled={pending} variant="secondary" type="button">
        {homeworkCopy.cancel}
      </AlertDialog.Cancel>
      <AlertDialog.Action
        disabled={pending}
        type="button"
        variant="destructive"
        onclick={confirmDelete}
      >
        {#if pending}
          <Spinner data-icon="inline-start" />
        {/if}
        {homeworkCopy.deleteAction}
      </AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>
