<script lang="ts">
import * as Item from "$lib/components/ui/item/index.js";
import SettingsAccountRow from "./SettingsAccountRow.svelte";
import SettingsDisconnectAccountDialog from "./SettingsDisconnectAccountDialog.svelte";
import SettingsPasskeysCard from "./SettingsPasskeysCard.svelte";
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

<section
  aria-label={copy.profile.linkedAccounts}
  class="grid gap-4"
>
  <Item.Group role="list">
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
</section>

<SettingsPasskeysCard {copy} />

<SettingsDisconnectAccountDialog
  {accountAction}
  {copy}
  {hasPendingAccountAction}
  {isMounted}
  {pendingAccountAction}
  {unlinkAccount}
  bind:unlinkAccountId
/>
