<script lang="ts">
import { enhance } from "$app/forms";
import { Button } from "$lib/components/ui/button/index.js";
import * as Dialog from "$lib/components/ui/dialog/index.js";
import type {
  SettingsAccount,
  SettingsAccountAction,
  SettingsCopy,
  SettingsPendingAccountAction,
} from "./settings-component-types";

export let accountAction: SettingsAccountAction;
export let copy: SettingsCopy;
export let hasPendingAccountAction: boolean;
export let isMounted: boolean;
export let pendingAccountAction: SettingsPendingAccountAction;
export let unlinkAccount: SettingsAccount | null;
export let unlinkAccountId: string | null;
</script>

{#if unlinkAccount}
  <Dialog.Root
    open={true}
    class="max-w-md"
    onOpenChange={(open) => {
      if (!open) unlinkAccountId = null;
    }}
  >
    <Dialog.Header>
      <Dialog.Title>{copy.profile.disconnectConfirmTitle}</Dialog.Title>
      <Dialog.Description>{copy.profile.disconnectConfirmDescription.replace("{provider}", unlinkAccount.name)}</Dialog.Description>
    </Dialog.Header>
    <Dialog.Footer>
      <Button
        variant="secondary"
        type="button"
        disabled={hasPendingAccountAction}
        onclick={() => {
          unlinkAccountId = null;
        }}
      >
        {copy.profile.cancel}
      </Button>
      <form
        method="POST"
        action="?/unlinkAccount&tab=accounts"
        use:enhance={accountAction(unlinkAccount.id, "disconnect")}
      >
        <input type="hidden" name="provider" value={unlinkAccount.id} />
        <Button
          type="submit"
          disabled={!isMounted || hasPendingAccountAction}
          variant="destructive"
        >
          {pendingAccountAction?.providerId === unlinkAccount.id &&
          pendingAccountAction.type === "disconnect"
            ? copy.profile.disconnecting
            : copy.profile.disconnect}
        </Button>
      </form>
    </Dialog.Footer>
  </Dialog.Root>
{/if}
