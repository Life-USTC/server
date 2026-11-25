<script lang="ts">
import * as AlertDialog from "#lib/components/ui/alert-dialog/index.js";
import { Badge } from "#lib/components/ui/badge/index.js";
import { Button } from "#lib/components/ui/button/index.js";
import * as Item from "#lib/components/ui/item/index.js";
import { Spinner } from "#lib/components/ui/spinner/index.js";
import type { AppLocale } from "@/i18n/config";
import { enhance } from "$app/forms";
import SettingsPasskeysCard from "./SettingsPasskeysCard.svelte";
import SettingsUstcIdentityPanel from "./SettingsUstcIdentityPanel.svelte";
import type {
  SettingsAccount,
  SettingsAccountAction,
  SettingsCopy,
  SettingsPendingAccountAction,
} from "./settings-component-types";

export let accountAction: SettingsAccountAction;
export let accounts: SettingsAccount[];
export let copy: SettingsCopy;
export let locale: AppLocale;
export let isMounted: boolean;
export let pendingAccountAction: SettingsPendingAccountAction;
export let unlinkAccountId: string | null;
$: hasPendingAccountAction = Boolean(pendingAccountAction);
$: unlinkAccount = accounts.find(
  (account) => account.id === unlinkAccountId && account.linked,
);
</script>

<section
  aria-label={copy.profile.linkedAccounts}
  class="grid gap-4"
>
  <Item.Group role="list">
    {#each accounts as account}
      <Item.Root role="listitem" variant="outline">
        <Item.Content class="min-w-0">
          <Item.Title>{account.name}</Item.Title>
          <Item.Description class="truncate">
            {account.linked ? account.providerAccountId : copy.profile.notConnected}
          </Item.Description>
        </Item.Content>
        <Item.Actions class="flex-wrap justify-end">
          {#if account.linked}
            <Badge variant="secondary">{copy.profile.connected}</Badge>
            <Button

              variant="outline"
              type="button"
              disabled={!isMounted || !account.canUnlink || hasPendingAccountAction}
              onclick={() => {
                unlinkAccountId = account.id;
              }}
            >
              {copy.profile.disconnect}
            </Button>
          {:else}
            <form
              method="POST"
              action="?/linkAccount"
              use:enhance={accountAction(account.id, "connect")}
            >
              <input type="hidden" name="providerId" value={account.id} />
              <Button
                type="submit"
                disabled={!isMounted || hasPendingAccountAction}
              >
                {pendingAccountAction?.providerId === account.id &&
                pendingAccountAction.type === "connect"
                  ? copy.profile.pleaseWait
                  : copy.profile.connect}
              </Button>
            </form>
          {/if}
        </Item.Actions>
        {#if account.linked && !account.canUnlink}
          <Item.Footer>
            {copy.profile.cannotDisconnectLast}
          </Item.Footer>
        {/if}
      </Item.Root>

      <SettingsUstcIdentityPanel {account} {copy} {locale} />
    {/each}
  </Item.Group>
</section>

<SettingsPasskeysCard {copy} {locale} />

{#if unlinkAccount}
  {@const disconnecting = pendingAccountAction?.providerId === unlinkAccount.id && pendingAccountAction.type === "disconnect"}
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
            {#if disconnecting}
              <Spinner data-icon="inline-start" />
            {/if}
            {disconnecting ? copy.profile.disconnecting : copy.profile.disconnect}
          </AlertDialog.Action>
        </AlertDialog.Footer>
      </form>
    </AlertDialog.Content>
  </AlertDialog.Root>
{/if}
