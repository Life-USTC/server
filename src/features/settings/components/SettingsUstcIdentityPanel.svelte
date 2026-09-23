<script lang="ts">
import * as Item from "$lib/components/ui/item/index.js";
import type { SettingsAccount, SettingsCopy } from "./settings-component-types";

export let account: SettingsAccount;
export let copy: SettingsCopy;

$: identityCopy = copy.profile;
$: identities = account.ustcIdentities?.records ?? [];
</script>

{#if account.id === "oidc" && account.linked}
  <Item.Root class="col-span-full" role="listitem" variant="muted">
    <Item.Content class="gap-3">
      <div>
        <Item.Title>{identityCopy.ustcIdentityTitle}</Item.Title>
        <Item.Description>{identityCopy.ustcIdentityDescription}</Item.Description>
      </div>

      {#if identities.length === 0}
        <p class="text-muted-foreground text-sm">
          {identityCopy.ustcIdentityEmpty}
        </p>
      {:else}
        <div class="grid gap-3">
          {#each identities as identity}
            <div class="rounded-md border bg-background p-3 text-sm">
              <dl class="grid gap-2">
                <div class="grid gap-1">
                  <dt class="text-muted-foreground text-xs">
                    {identityCopy.ustcIdentityUpstreamUid}
                  </dt>
                  <dd class="font-mono break-all">{identity.upstreamUid}</dd>
                </div>
                <div class="grid gap-1">
                  <dt class="text-muted-foreground text-xs">
                    {identityCopy.ustcIdentityGid}
                  </dt>
                  <dd class="font-mono break-all">
                    {identity.gid ?? identityCopy.ustcIdentityUnknown}
                  </dd>
                </div>
                <div class="grid gap-1">
                  <dt class="text-muted-foreground text-xs">
                    {identityCopy.ustcIdentitySno}
                  </dt>
                  <dd class="font-mono break-all">
                    {identity.sno ?? identityCopy.ustcIdentityUnknown}
                  </dd>
                </div>
                <div class="grid gap-1">
                  <dt class="text-muted-foreground text-xs">
                    {identityCopy.ustcIdentityLastSyncedAt}
                  </dt>
                  <dd>
                    {new Date(identity.lastSyncedAt).toLocaleString()}
                  </dd>
                </div>
              </dl>
            </div>
          {/each}
        </div>
      {/if}
    </Item.Content>
  </Item.Root>
{/if}
