<script lang="ts">
import { toast } from "@ui-sdk/svelte/toast";
import { untrack } from "svelte";
import * as Alert from "#lib/components/ui/alert/index.js";
import * as AlertDialog from "#lib/components/ui/alert-dialog/index.js";
import { Button } from "#lib/components/ui/button/index.js";
import * as Dialog from "#lib/components/ui/dialog/index.js";
import * as Field from "#lib/components/ui/field/index.js";
import { Input } from "#lib/components/ui/input/index.js";
import { invalidateAll } from "$app/navigation";
import type { getUploadPageCopy } from "../server/upload-page-copy";

let {
  upload,
  action,
  copy,
  close,
}: {
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
    const response = await fetch(
      `/api/workspace/uploads/${encodeURIComponent(upload.id)}`,
      {
        method: action === "rename" ? "PATCH" : "DELETE",
        ...(action === "rename"
          ? {
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ filename: filename.trim() }),
            }
          : {}),
      },
    );
    if (!response.ok) throw new Error();
    await invalidateAll();
    toast.success(
      action === "rename"
        ? copy.toastRenameSuccessTitle
        : copy.toastDeleteSuccessTitle,
      {
        description: upload.filename,
      },
    );
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
      <Dialog.Header heading={copy.renameAction}>
        <Dialog.Description class="break-all">{upload.filename}</Dialog.Description>
      </Dialog.Header>
      <form onsubmit={submit} class="grid gap-4">
        <Field.FieldGroup>
          <Field.Field>
            <Field.FieldLabel for="upload-filename">{copy.tableName}</Field.FieldLabel>
            <Input id="upload-filename" bind:value={filename} required maxlength={255} disabled={pending} />
          </Field.Field>
        </Field.FieldGroup>
        {#if failed}<Alert.Message variant="destructive">{copy.toastRenameErrorDescription}</Alert.Message>{/if}
        <Dialog.Actions cancelLabel={copy.cancelRenameAction} onCancel={close} cancelDisabled={pending}>
          <Button loading={pending} type="submit" disabled={pending || !filename.trim()}>{copy.saveRenameAction}</Button>
        </Dialog.Actions>
      </form>
    </Dialog.Content>
  </Dialog.Root>
{:else}
  <AlertDialog.Root open={true} onOpenChange={(open) => { if (!open && !pending) close(); }}>
    <AlertDialog.Confirmation
      compact
      title={copy.deleteAction}
      description={copy.deleteConfirm.replace("{name}", upload.filename)}
      descriptionClass="break-words"
      error={failed ? copy.toastDeleteErrorDescription : ""}
      cancelLabel={copy.cancelRenameAction}
      confirmLabel={copy.deleteAction}
      {pending}
      onclick={submit}
    />
  </AlertDialog.Root>
{/if}
