<script lang="ts">
import * as Item from "#lib/components/ui/item/index.js";
import type { AppLocale } from "@/i18n/config";
import { campusTimestampFormatter } from "@/lib/time/shanghai-format";
import type { SettingsAccount, SettingsCopy } from "./settings-component-types";

export let account: SettingsAccount;
export let copy: SettingsCopy;
export let locale: AppLocale;
$: dateFormatter = campusTimestampFormatter(locale);

$: identityCopy = copy.profile;
$: identities = account.ustcIdentities?.records ?? [];
</script>

{#snippet identifier(label: string, value: string)}
  <div class="grid gap-1">
    <dt class="text-muted-foreground text-xs">{label}</dt>
    <dd class="font-mono break-all">{value}</dd>
  </div>
{/snippet}

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
            <div class="rounded-xl border bg-background p-3 text-sm">
              <dl class="grid gap-2">
                {@render identifier(identityCopy.ustcIdentityUpstreamUid, identity.upstreamUid)}
                {@render identifier(identityCopy.ustcIdentityGid, identity.gid ?? identityCopy.ustcIdentityUnknown)}
                {@render identifier(identityCopy.ustcIdentitySno, identity.sno ?? identityCopy.ustcIdentityUnknown)}
                <div class="grid gap-1">
                  <dt class="text-muted-foreground text-xs">
                    {identityCopy.ustcIdentityLastSyncedAt}
                  </dt>
                  <dd>
                    {dateFormatter.format(new Date(identity.lastSyncedAt))}
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
