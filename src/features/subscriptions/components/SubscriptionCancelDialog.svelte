<script lang="ts">
import * as Alert from "#lib/components/ui/alert/index.js";
import * as AlertDialog from "#lib/components/ui/alert-dialog/index.js";
import { Spinner } from "#lib/components/ui/spinner/index.js";

let {
  open = $bindable(false),
  name,
  copy,
  onconfirm,
  onOpenChange,
}: {
  open?: boolean;
  name: string;
  copy: {
    unsubscribeTitle: string;
    unsubscribeDescription: string;
    cancelUnsubscribe: string;
    confirmUnsubscribe: string;
    optOutError: string;
  };
  onconfirm: () => boolean | Promise<boolean>;
  onOpenChange?: (value: boolean) => void;
} = $props();
let pending = $state(false);
let failed = $state(false);
function change(value: boolean) {
  if (pending) return;
  open = value;
  if (!value) failed = false;
  onOpenChange?.(value);
}
async function confirm(event: MouseEvent) {
  event.preventDefault();
  if (pending) return;
  pending = true;
  failed = false;
  try {
    if (await onconfirm()) {
      pending = false;
      change(false);
    } else failed = true;
  } catch {
    failed = true;
  } finally {
    pending = false;
  }
}
</script>
<AlertDialog.Root {open} onOpenChange={change}>
  <AlertDialog.Content escapeKeydownBehavior={pending ? "ignore" : "close"}>
    <AlertDialog.Header>
      <AlertDialog.Title>{copy.unsubscribeTitle}</AlertDialog.Title>
      <AlertDialog.Description>{copy.unsubscribeDescription.replace("{name}", name)}</AlertDialog.Description>
    </AlertDialog.Header>
    {#if failed}<Alert.Root variant="destructive"><Alert.Description>{copy.optOutError}</Alert.Description></Alert.Root>{/if}
    <AlertDialog.Footer>
      <AlertDialog.Cancel disabled={pending}>{copy.cancelUnsubscribe}</AlertDialog.Cancel>
      <AlertDialog.Action variant="destructive" disabled={pending} onclick={confirm}>
        {#if pending}<Spinner data-icon="inline-start" aria-hidden="true" />{/if}
        {copy.confirmUnsubscribe}
      </AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>
