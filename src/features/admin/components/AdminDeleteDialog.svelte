<script lang="ts">
import TrashIcon from "@lucide/svelte/icons/trash-2";
import type { Snippet } from "svelte";
import * as AlertDialog from "#lib/components/ui/alert-dialog/index.js";
import { Spinner } from "#lib/components/ui/spinner/index.js";
import { enhance, type SubmitFunction } from "$app/forms";

let {
  title,
  titleId,
  description,
  cancelLabel,
  confirmLabel,
  close,
  action,
  submit,
  busy,
  deleting,
  trashIcon = true,
  wide = false,
  children,
}: {
  title: string;
  titleId: string;
  description: string;
  cancelLabel: string;
  confirmLabel: string;
  close: () => void;
  action: string;
  submit: SubmitFunction;
  busy: boolean;
  deleting?: boolean;
  trashIcon?: boolean;
  wide?: boolean;
  children: Snippet;
} = $props();
</script>

<AlertDialog.Root open={true} onOpenChange={(open) => { if (!open && !busy) close(); }}>
  <AlertDialog.Content class={wide ? "max-w-lg sm:max-w-lg" : "max-w-md sm:max-w-md"} aria-labelledby={titleId}>
    <div data-slot="alert-dialog-header">
      <AlertDialog.Title id={titleId}>{title}</AlertDialog.Title>
      <AlertDialog.Description>{description}</AlertDialog.Description>
    </div>
    <form method="POST" {action} use:enhance={submit}>
      <div class="grid gap-2 px-5 py-4 text-sm">{@render children()}</div>
      <div data-slot="alert-dialog-footer">
        <AlertDialog.Cancel type="button" disabled={busy} variant="outline">{cancelLabel}</AlertDialog.Cancel>
        <AlertDialog.Action type="submit" disabled={busy} variant="destructive">
          {#if deleting ?? busy}<Spinner data-icon="inline-start" />{:else if trashIcon}<TrashIcon data-icon="inline-start" />{/if}
          {confirmLabel}
        </AlertDialog.Action>
      </div>
    </form>
  </AlertDialog.Content>
</AlertDialog.Root>
