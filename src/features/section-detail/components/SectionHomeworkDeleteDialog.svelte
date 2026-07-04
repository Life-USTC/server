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
  onOpenChange={(open) => {
    if (!open) onCancel();
  }}
>
  <Dialog.Content
    class="max-w-md"
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
        type="button"
        variant="destructive"
        onclick={onConfirm}
      >
        {homeworkCopy.deleteAction}
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
