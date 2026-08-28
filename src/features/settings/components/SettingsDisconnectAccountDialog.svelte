<script lang="ts">
import { enhance } from "$app/forms";
import * as AlertDialog from "$lib/components/ui/alert-dialog/index.js";
import { Spinner } from "$lib/components/ui/spinner/index.js";
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
  <AlertDialog.Root
    open={true}
    onOpenChange={(open) => {
      if (!open && !hasPendingAccountAction) unlinkAccountId = null;
    }}
  >
    <AlertDialog.Content
      class="max-w-md sm:max-w-md"
    >
      <AlertDialog.Header>
        <AlertDialog.Title>{copy.profile.disconnectConfirmTitle}</AlertDialog.Title>
        <AlertDialog.Description>{copy.profile.disconnectConfirmDescription.replace("{provider}", unlinkAccount.name)}</AlertDialog.Description>
      </AlertDialog.Header>
      <form
          method="POST"
          action="?/unlinkAccount"
          use:enhance={accountAction(unlinkAccount.id, "disconnect")}
        >
          <input type="hidden" name="provider" value={unlinkAccount.id} />
        <AlertDialog.Footer>
          <AlertDialog.Cancel
            variant="secondary"
            type="button"
            disabled={hasPendingAccountAction}
          >
            {copy.profile.cancel}
          </AlertDialog.Cancel>
          <AlertDialog.Action
            type="submit"
            disabled={!isMounted || hasPendingAccountAction}
            variant="destructive"
          >
            {#if pendingAccountAction?.providerId === unlinkAccount.id &&
            pendingAccountAction.type === "disconnect"}
              <Spinner data-icon="inline-start" />
            {/if}
            {pendingAccountAction?.providerId === unlinkAccount.id &&
            pendingAccountAction.type === "disconnect"
              ? copy.profile.disconnecting
              : copy.profile.disconnect}
          </AlertDialog.Action>
        </AlertDialog.Footer>
      </form>
    </AlertDialog.Content>
  </AlertDialog.Root>
{/if}
