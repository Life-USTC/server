<script lang="ts">
import type { Passkey } from "@better-auth/passkey";
import { passkeyAuthClient } from "#lib/auth/passkey-client.js";
import * as AlertDialog from "#lib/components/ui/alert-dialog/index.js";
import { Button } from "#lib/components/ui/button/index.js";
import * as InputGroup from "#lib/components/ui/input-group/index.js";
import * as Item from "#lib/components/ui/item/index.js";
import { Spinner } from "#lib/components/ui/spinner/index.js";
import type { AppLocale } from "@/i18n/config";
import { campusTimestampFormatter } from "@/lib/time/shanghai-format";
import { invalidateAll } from "$app/navigation";
import type { SettingsCopy } from "./settings-component-types";

export let copy: SettingsCopy;
export let locale: AppLocale;
export let passkey: Passkey;
export let reportError: (cause?: unknown) => void;
export let onSuccess: (message: string) => void = () => {};

let deleteOpen = false;
let pending: "rename" | "delete" | null = null;
let name = passkey.name?.trim() || copy.settings.passkeys.unnamed;

$: displayName = passkey.name?.trim() || copy.settings.passkeys.unnamed;
$: hasNameChange = name.trim().length > 0 && name.trim() !== displayName;
$: createdAt = new Date(passkey.createdAt);
$: createdAtLabel = campusTimestampFormatter(locale).format(createdAt);

async function changePasskey(action: "rename" | "delete") {
  if (pending || (action === "rename" && !hasNameChange)) return;

  pending = action;
  try {
    const result =
      action === "rename"
        ? await passkeyAuthClient.passkey.updatePasskey({
            id: passkey.id,
            name: name.trim(),
          })
        : await passkeyAuthClient.passkey.deletePasskey({ id: passkey.id });
    if (result.error) {
      deleteOpen = false;
      reportError(result.error);
      return;
    }
    if (action === "delete") deleteOpen = false;
    onSuccess(
      action === "rename"
        ? copy.settings.passkeys.renamed
        : copy.settings.passkeys.deleted,
    );
    if (action === "delete") await invalidateAll();
  } catch {
    if (action === "delete") deleteOpen = false;
    reportError();
  } finally {
    pending = null;
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
          disabled={!hasNameChange || Boolean(pending)}
          onclick={() => changePasskey("rename")}
          type="button"
        >
          {#if pending === "rename"}
            <Spinner data-icon="inline-start" />
            {copy.settings.passkeys.saving}
          {:else}
            {copy.settings.passkeys.save}
          {/if}
        </InputGroup.Button>
      </InputGroup.Addon>
    </InputGroup.Root>
    <Item.Description>
      {copy.settings.passkeys.createdAt}:
      <time datetime={createdAt.toISOString()}>{createdAtLabel}</time>
    </Item.Description>
  </Item.Content>
  <Item.Actions>
    <Button
      disabled={Boolean(pending)}
      onclick={() => {
        deleteOpen = true;
      }}

      type="button"
      variant="outline"
    >
      {copy.settings.passkeys.delete}
    </Button>
  </Item.Actions>
</Item.Root>

<AlertDialog.Root
  bind:open={deleteOpen}
  onOpenChange={(open) => {
    if (open || pending !== "delete") deleteOpen = open;
  }}
>
  <AlertDialog.Confirmation
    title={copy.settings.passkeys.deleteConfirmTitle}
    description={copy.settings.passkeys.deleteConfirmDescription.replace("{name}", displayName)}
    cancelLabel={copy.settings.passkeys.cancel}
    confirmLabel={pending === "delete" ? copy.settings.passkeys.deleting : copy.settings.passkeys.delete}
    pending={pending === "delete"}
    onclick={() => changePasskey("delete")}
  />
</AlertDialog.Root>
