<script lang="ts">
import type { Passkey } from "@better-auth/passkey";
import {
  passkeyAuthClient,
  passkeyClientErrorKind,
} from "$lib/auth/passkey-client";
import * as AlertDialog from "$lib/components/ui/alert-dialog/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import * as InputGroup from "$lib/components/ui/input-group/index.js";
import * as Item from "$lib/components/ui/item/index.js";
import { Spinner } from "$lib/components/ui/spinner/index.js";
import type { SettingsCopy } from "./settings-component-types";

type Status = {
  kind: "error" | "success";
  message: string;
};

export let copy: SettingsCopy;
export let passkey: Passkey;
export let reportStatus: (status: Status) => void;

let deleteOpen = false;
let deleting = false;
let name = passkey.name?.trim() || copy.settings.passkeys.unnamed;
let saving = false;

$: displayName = passkey.name?.trim() || copy.settings.passkeys.unnamed;
$: hasNameChange = name.trim().length > 0 && name.trim() !== displayName;

function errorMessage(error: unknown) {
  const kind = passkeyClientErrorKind(error);
  if (kind === "stale-session") return copy.settings.passkeys.staleSession;
  if (kind === "duplicate") return copy.settings.passkeys.duplicate;
  if (kind === "cancelled") return copy.settings.passkeys.cancelled;
  return copy.settings.passkeys.genericError;
}

async function renamePasskey() {
  const nextName = name.trim();
  if (!nextName || !hasNameChange || saving || deleting) return;

  saving = true;
  try {
    const result = await passkeyAuthClient.passkey.updatePasskey({
      id: passkey.id,
      name: nextName,
    });
    if (result.error) {
      deleteOpen = false;
      reportStatus({ kind: "error", message: errorMessage(result.error) });
      return;
    }
    reportStatus({
      kind: "success",
      message: copy.settings.passkeys.renamed,
    });
  } catch {
    reportStatus({
      kind: "error",
      message: copy.settings.passkeys.genericError,
    });
  } finally {
    saving = false;
  }
}

async function deletePasskey() {
  if (deleting || saving) return;

  deleting = true;
  try {
    const result = await passkeyAuthClient.passkey.deletePasskey({
      id: passkey.id,
    });
    if (result.error) {
      reportStatus({ kind: "error", message: errorMessage(result.error) });
      return;
    }
    deleteOpen = false;
    reportStatus({
      kind: "success",
      message: copy.settings.passkeys.deleted,
    });
  } catch {
    deleteOpen = false;
    reportStatus({
      kind: "error",
      message: copy.settings.passkeys.genericError,
    });
  } finally {
    deleting = false;
  }
}
</script>

<Item.Root variant="outline">
  <Item.Content class="min-w-0">
    <label class="sr-only" for={`passkey-name-${passkey.id}`}>
      {copy.settings.passkeys.renameLabel.replace("{name}", displayName)}
    </label>
    <InputGroup.Root>
      <InputGroup.Input
        autocomplete="off"
        id={`passkey-name-${passkey.id}`}
        maxlength={64}
        bind:value={name}
      />
      <InputGroup.Addon align="inline-end">
        <InputGroup.Button
          disabled={!hasNameChange || saving || deleting}
          onclick={renamePasskey}
          type="button"
        >
          {#if saving}
            <Spinner data-icon="inline-start" />
            {copy.settings.passkeys.saving}
          {:else}
            {copy.settings.passkeys.save}
          {/if}
        </InputGroup.Button>
      </InputGroup.Addon>
    </InputGroup.Root>
  </Item.Content>
  <Item.Actions>
    <Button
      disabled={saving || deleting}
      onclick={() => {
        deleteOpen = true;
      }}
      size="sm"
      type="button"
      variant="outline"
    >
      {copy.settings.passkeys.delete}
    </Button>
  </Item.Actions>
</Item.Root>

<AlertDialog.Root bind:open={deleteOpen}>
  <AlertDialog.Content class="max-w-md sm:max-w-md">
    <AlertDialog.Header>
      <AlertDialog.Title>
        {copy.settings.passkeys.deleteConfirmTitle}
      </AlertDialog.Title>
      <AlertDialog.Description>
        {copy.settings.passkeys.deleteConfirmDescription.replace(
          "{name}",
          displayName,
        )}
      </AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel disabled={deleting} type="button">
        {copy.settings.passkeys.cancel}
      </AlertDialog.Cancel>
      <Button
        disabled={deleting}
        onclick={deletePasskey}
        type="button"
        variant="destructive"
      >
        {#if deleting}
          <Spinner data-icon="inline-start" />
          {copy.settings.passkeys.deleting}
        {:else}
          {copy.settings.passkeys.delete}
        {/if}
      </Button>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>
