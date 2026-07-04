<script lang="ts">
import * as Card from "$lib/components/ui/card/index.js";
import * as Item from "$lib/components/ui/item/index.js";
import SettingsAccountRow from "./SettingsAccountRow.svelte";
import SettingsDisconnectAccountDialog from "./SettingsDisconnectAccountDialog.svelte";
import type {
  SettingsAccount,
  SettingsAccountAction,
  SettingsCopy,
  SettingsPendingAccountAction,
  SettingsUser,
} from "./settings-component-types";

export let accountAction: SettingsAccountAction;
export let accounts: SettingsAccount[];
export let copy: SettingsCopy;
export let hasPendingAccountAction: boolean;
export let isMounted: boolean;
export let pendingAccountAction: SettingsPendingAccountAction;
export let unlinkAccount: SettingsAccount | null;
export let unlinkAccountId: string | null;
export let user: SettingsUser;
</script>

<Card.Root>
  <Card.Header>
    <Card.Title>{copy.profile.linkedAccounts}</Card.Title>
    <Card.Description>
      {copy.profile.linkedAccountsDescription}
    </Card.Description>
  </Card.Header>
  <Card.Content>
    <Item.Group>
      {#each accounts as account}
        <SettingsAccountRow
          {account}
          {accountAction}
          {copy}
          {hasPendingAccountAction}
          {isMounted}
          {pendingAccountAction}
          bind:unlinkAccountId
          {user}
        />
      {/each}
    </Item.Group>
  </Card.Content>
</Card.Root>

<SettingsDisconnectAccountDialog
  {accountAction}
  {copy}
  {hasPendingAccountAction}
  {isMounted}
  {pendingAccountAction}
  {unlinkAccount}
  bind:unlinkAccountId
/>
