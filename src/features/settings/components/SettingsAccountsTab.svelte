<script lang="ts">
import * as Card from "$lib/components/ui/card/index.js";
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

<Card.Root class="border-base-300 bg-base-100">
  <Card.Header>
    <Card.Title>{copy.profile.linkedAccounts}</Card.Title>
    <Card.Description>
      {copy.profile.linkedAccountsDescription}
    </Card.Description>
  </Card.Header>
  <Card.Content>
    <div class="grid gap-3">
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
    </div>
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
