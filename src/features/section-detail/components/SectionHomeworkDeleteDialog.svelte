<script lang="ts">
import * as AlertDialog from "$lib/components/ui/alert-dialog/index.js";
import { Button } from "$lib/components/ui/button/index.js";

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

<AlertDialog.Root
  open={true}
  onOpenChange={(open) => {
    if (!open) onCancel();
  }}
>
  <AlertDialog.Content
    class="max-w-md"
  >
    <AlertDialog.Header>
      <AlertDialog.Title>{homeworkCopy.deleteTitle}</AlertDialog.Title>
      <AlertDialog.Description>
        {formatMessage(homeworkCopy.deleteDescription, { title: target.title })}
      </AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel variant="secondary" type="button">
        {homeworkCopy.cancel}
      </AlertDialog.Cancel>
      <Button
        type="button"
        variant="destructive"
        onclick={onConfirm}
      >
        {homeworkCopy.deleteAction}
      </Button>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>
