<script lang="ts">
import { untrack } from "svelte";
import { toast } from "svelte-sonner";
import { invalidateAll } from "$app/navigation";
import * as Alert from "$lib/components/ui/alert";
import * as AlertDialog from "$lib/components/ui/alert-dialog";
import { Button } from "$lib/components/ui/button";
import * as Dialog from "$lib/components/ui/dialog";
import * as Field from "$lib/components/ui/field";
import { Input } from "$lib/components/ui/input";
import { Spinner } from "$lib/components/ui/spinner";
import type { getUploadPageCopy } from "../server/upload-page-copy";

let { upload, action, copy, close }: {
  upload: { id: string; filename: string };
  action: "rename" | "delete";
  copy: ReturnType<typeof getUploadPageCopy>["uploads"];
  close: () => void;
} = $props();
let filename = $state(untrack(() => upload.filename));
let pending = $state(false);
let failed = $state(false);
async function submit(event: Event) {
  event.preventDefault();
  if (pending || (action === "rename" && !filename.trim())) return;
  pending = true;
  failed = false;
  try {
    const response = await fetch(`/api/workspace/uploads/${encodeURIComponent(upload.id)}`, {
      method: action === "rename" ? "PATCH" : "DELETE",
      ...(action === "rename" ? {
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: filename.trim() }),
      } : {}),
    });
    if (!response.ok) throw new Error();
    await invalidateAll();
    toast.success(action === "rename" ? copy.toastRenameSuccessTitle : copy.toastDeleteSuccessTitle, {
      description: upload.filename,
    });
    close();
  } catch {
    failed = true;
  } finally {
    pending = false;
  }
}
</script>

{#if action === "rename"}
  <Dialog.Root open={true} onOpenChange={(open) => { if (!open && !pending) close(); }}>
    <Dialog.Content showCloseButton={false}>
      <Dialog.Header>
        <Dialog.Title>{copy.renameAction}</Dialog.Title>
        <Dialog.Description class="break-all">{upload.filename}</Dialog.Description>
      </Dialog.Header>
      <form onsubmit={submit} class="grid gap-4">
        <Field.FieldGroup>
          <Field.Field>
            <Field.FieldLabel for="upload-filename">{copy.tableName}</Field.FieldLabel>
            <Input id="upload-filename" bind:value={filename} required maxlength={255} disabled={pending} />
          </Field.Field>
        </Field.FieldGroup>
        {#if failed}<Alert.Root variant="destructive"><Alert.Description>{copy.toastRenameErrorDescription}</Alert.Description></Alert.Root>{/if}
        <Dialog.Footer>
          <Button type="button" variant="outline" onclick={close} disabled={pending}>{copy.cancelRenameAction}</Button>
          <Button type="submit" disabled={pending || !filename.trim()}>{#if pending}<Spinner data-icon="inline-start" />{/if}{copy.saveRenameAction}</Button>
        </Dialog.Footer>
      </form>
    </Dialog.Content>
  </Dialog.Root>
{:else}
  <AlertDialog.Root open={true} onOpenChange={(open) => { if (!open && !pending) close(); }}>
    <AlertDialog.Content>
      <AlertDialog.Header>
        <AlertDialog.Title>{copy.deleteAction}</AlertDialog.Title>
        <AlertDialog.Description class="break-words">{copy.deleteConfirm.replace("{name}", upload.filename)}</AlertDialog.Description>
      </AlertDialog.Header>
      {#if failed}<Alert.Root variant="destructive"><Alert.Description>{copy.toastDeleteErrorDescription}</Alert.Description></Alert.Root>{/if}
      <AlertDialog.Footer>
        <AlertDialog.Cancel disabled={pending}>{copy.cancelRenameAction}</AlertDialog.Cancel>
        <AlertDialog.Action variant="destructive" disabled={pending} onclick={submit}>{#if pending}<Spinner data-icon="inline-start" />{/if}{copy.deleteAction}</AlertDialog.Action>
      </AlertDialog.Footer>
    </AlertDialog.Content>
  </AlertDialog.Root>
{/if}
