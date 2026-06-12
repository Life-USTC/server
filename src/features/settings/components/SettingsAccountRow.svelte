<script lang="ts">
import { enhance } from "$app/forms";
import { Badge } from "$lib/components/ui/badge/index.js";
import { Button } from "$lib/components/ui/button/index.js";
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

<div class="rounded-lg border border-base-300 bg-base-100 p-4 transition hover:border-primary/70">
  <div class="flex flex-wrap items-center gap-3">
    <div class="min-w-0 flex-1">
      <h3 class="font-medium">{account.name}</h3>
      <p class="truncate text-base-content/60 text-sm">
        {account.linked ? account.providerAccountId : copy.profile.notConnected}
      </p>
    </div>
    {#if account.linked}
      <Badge class="border-success bg-success text-success-content">{copy.profile.connected}</Badge>
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
  </div>
  {#if account.linked && user.accountCount <= 1}
    <p class="mt-2 text-warning text-sm">{copy.profile.cannotDisconnectLast}</p>
  {/if}
</div>
