<script lang="ts">
import { Badge } from "$lib/components/ui/badge/index.js";
import * as Item from "$lib/components/ui/item/index.js";

export let clientTypeLabel: (method: string) => string;
export let copy: Record<string, string>;
export let redirectUris: string[];
export let scopes: string[];
export let scopeLabel: (scope: string) => string;
export let tokenEndpointAuthMethod: string | null | undefined;
export let trusted: boolean | null | undefined;
</script>

<Item.Group class="gap-3">
  <Item.Root variant="muted">
    <Item.Content>
      <Item.Title>{copy.clientType}</Item.Title>
      <div class="flex flex-wrap gap-1.5">
        <Badge variant="ghost">
          {clientTypeLabel(tokenEndpointAuthMethod ?? "client_secret_basic")}
        </Badge>
        {#if trusted}
          <Badge variant="outline">{copy.clientTrustTrusted}</Badge>
        {/if}
      </div>
    </Item.Content>
  </Item.Root>
  <Item.Root variant="muted">
    <Item.Content>
      <Item.Title>{copy.permissionsTitle}</Item.Title>
      <div class="flex flex-wrap gap-1.5">
        {#each scopes as scope}
          <Badge class="font-mono" variant="ghost">{scopeLabel(scope)}</Badge>
        {:else}
          <span class="text-base-content/60">{copy.notAvailable}</span>
        {/each}
      </div>
    </Item.Content>
  </Item.Root>
  <Item.Root variant="muted">
    <Item.Content class="min-w-0">
      <Item.Title>{copy.redirectUris}</Item.Title>
      <div class="grid gap-1">
        {#each redirectUris as uri}
          <p class="break-all font-mono text-base-content/70 text-xs">{uri}</p>
        {:else}
          <p class="text-base-content/60">{copy.notAvailable}</p>
        {/each}
      </div>
    </Item.Content>
  </Item.Root>
</Item.Group>
