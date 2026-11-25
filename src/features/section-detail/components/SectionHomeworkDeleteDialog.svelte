<script lang="ts">
import * as AlertDialog from "#lib/components/ui/alert-dialog/index.js";

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
    <AlertDialog.Heading
      title={homeworkCopy.deleteTitle}
      description={formatMessage(homeworkCopy.deleteDescription, { title: target.title })}
    />
    <AlertDialog.Actions
      cancelLabel={homeworkCopy.cancel}
      confirmLabel={homeworkCopy.deleteAction}
      {pending}
      secondaryCancel
      onclick={confirmDelete}
    />
  </AlertDialog.Content>
</AlertDialog.Root>
