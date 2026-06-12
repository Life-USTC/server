<script lang="ts">
import { Button } from "$lib/components/ui/button/index.js";
import * as Dialog from "$lib/components/ui/dialog/index.js";

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
</script>

<Dialog.Root
  open={true}
  class="max-w-md"
  onOpenChange={(open) => {
    if (!open) onCancel();
  }}
>
  <Dialog.Header>
    <Dialog.Title>{homeworkCopy.deleteTitle}</Dialog.Title>
    <Dialog.Description>
      {formatMessage(homeworkCopy.deleteDescription, { title: target.title })}
    </Dialog.Description>
  </Dialog.Header>
  <Dialog.Footer>
    <Button variant="secondary" type="button" onclick={onCancel}>
      {homeworkCopy.cancel}
    </Button>
    <Button
      class="border-error bg-error text-error-content hover:bg-error/90"
      type="button"
      onclick={onConfirm}
    >
      {homeworkCopy.deleteAction}
    </Button>
  </Dialog.Footer>
</Dialog.Root>
