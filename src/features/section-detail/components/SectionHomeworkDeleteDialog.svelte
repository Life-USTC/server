<script lang="ts">
import * as AlertDialog from "#lib/components/ui/alert-dialog/index.js";
import type { SectionDetailCopy } from "@/features/section-detail/lib/section-detail-controller-types";

type HomeworkTarget = {
  title: string;
};

export let formatMessage: (
  template: string,
  values: Record<string, string>,
) => string;
export let homeworkCopy: SectionDetailCopy["homeworks"];
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
  <AlertDialog.Confirmation
    title={homeworkCopy.deleteTitle}
    description={formatMessage(homeworkCopy.deleteDescription, { title: target.title })}
    cancelLabel={homeworkCopy.cancel}
    confirmLabel={homeworkCopy.deleteAction}
    {pending}
    secondaryCancel
    onclick={confirmDelete}
  />
</AlertDialog.Root>
