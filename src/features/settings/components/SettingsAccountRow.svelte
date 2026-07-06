<script lang="ts">
import { enhance } from "$app/forms";
import { Badge } from "$lib/components/ui/badge/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import * as Item from "$lib/components/ui/item/index.js";
import type {
  SettingsAccount,
  SettingsAccountAction,
  SettingsCopy,
  SettingsPendingAccountAction,
  SettingsUser,
} from "./settings-component-types";

export let account: SettingsAccount;
export let accountAction: SettingsAccountAction;
export let copy: SettingsCopy;
export let hasPendingAccountAction: boolean;
export let isMounted: boolean;
export let pendingAccountAction: SettingsPendingAccountAction;
export let unlinkAccountId: string | null;
export let user: SettingsUser;
</script>

<Item.Root variant="outline">
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
        size="sm"
        variant="outline"
        type="button"
        disabled={!isMounted || user.accountCount <= 1 || hasPendingAccountAction}
        onclick={() => {
          unlinkAccountId = account.id;
        }}
      >
        {copy.profile.disconnect}
      </Button>
    {:else}
      <form
        method="POST"
        action="?/linkAccount&tab=accounts"
        use:enhance={accountAction(account.id, "connect")}
      >
        <input type="hidden" name="providerId" value={account.id} />
        <Button
          size="sm"
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
  {#if account.linked && user.accountCount <= 1}
    <Item.Footer>
      {copy.profile.cannotDisconnectLast}
    </Item.Footer>
  {/if}
</Item.Root>
