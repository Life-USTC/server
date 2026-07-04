<script lang="ts">
import CopyIcon from "@lucide/svelte/icons/copy";
import TrashIcon from "@lucide/svelte/icons/trash-2";
import { Badge } from "$lib/components/ui/badge/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import * as Card from "$lib/components/ui/card/index.js";
import * as Item from "$lib/components/ui/item/index.js";
import type { AdminOAuthClient } from "./admin-oauth-client-types";

export let client: AdminOAuthClient;
export let clientAuthCopy: (method: string) => string;
export let clientTypeLabel: (method: string) => string;
export let copy: Record<string, string>;
export let copyText: (value: string, message: string) => void;
export let formatCreatedAt: (value: string | Date) => string;
export let onDelete: (client: AdminOAuthClient) => void;
</script>

<article>
  <Card.Root class="border-l-4 border-l-primary">
    <Card.Header>
      <Card.Title>{client.name ?? copy.unnamedClient}</Card.Title>
      <Card.Description class="break-all font-mono text-xs">{client.clientId}</Card.Description>
      <Card.Action class="flex flex-wrap justify-end gap-2">
        <Badge variant="ghost">{clientTypeLabel(client.tokenEndpointAuthMethod)}</Badge>
        {#if client.skipConsent}<Badge class="border-warning bg-warning/10 text-warning" variant="outline">{copy.clientTrustTrusted}</Badge>{/if}
        {#if client.disabled}
          <Badge class="border-error bg-error/10 text-error" variant="outline">{copy.disabled}</Badge>
        {:else}
          <Badge class="border-success bg-success/10 text-success" variant="outline">{copy.enabled}</Badge>
        {/if}
      </Card.Action>
    </Card.Header>

    <Card.Content class="grid gap-3 text-sm lg:grid-cols-[220px_1fr_1fr]">
      <Item.Root class="items-start" variant="muted">
        <Item.Content>
          <Item.Title>{copy.clientType}</Item.Title>
          <div class="font-medium">{clientTypeLabel(client.tokenEndpointAuthMethod)}</div>
          <Item.Description>{clientAuthCopy(client.tokenEndpointAuthMethod)}</Item.Description>
        </Item.Content>
      </Item.Root>
      <Item.Root class="items-start" variant="muted">
        <Item.Content class="min-w-0">
          <Item.Title>{copy.redirectUris}</Item.Title>
          <div class="grid gap-1">
            {#each client.redirectUris as uri}
              <div class="flex items-start gap-2">
                <p class="min-w-0 flex-1 break-all font-mono text-muted-foreground text-xs">{uri}</p>
                <Button
                  aria-label={copy.copyRedirectUri}
                  class="shrink-0"
                  size="sm"
                  type="button"
                  variant="ghost"
                  onclick={() => copyText(uri, copy.redirectUriCopied)}
                >
                  <CopyIcon data-icon="inline-start" />
                  <span>{copy.copyRedirectUri}</span>
                </Button>
              </div>
            {:else}
              <p class="text-muted-foreground">{copy.notAvailable}</p>
            {/each}
          </div>
        </Item.Content>
      </Item.Root>
      <Item.Root class="items-start" variant="muted">
        <Item.Content>
          <Item.Title>{copy.tableColumnScopes}</Item.Title>
          <div class="flex flex-wrap gap-1.5">
            {#each client.scopes as scope}
              <Badge class="font-mono" variant="ghost">{scope}</Badge>
            {:else}
              <span class="text-muted-foreground">{copy.notAvailable}</span>
            {/each}
          </div>
        </Item.Content>
      </Item.Root>
    </Card.Content>

    <Card.Footer class="flex-wrap justify-between gap-3">
      <div class="flex flex-wrap gap-2">
        <Button size="sm" type="button" variant="outline" onclick={() => copyText(client.clientId, copy.clientIdCopied)}>
          <CopyIcon data-icon="inline-start" />
          <span>{copy.copyClientId}</span>
        </Button>
        <span class="self-center text-muted-foreground text-xs">{copy.createdAtLabel} {formatCreatedAt(client.createdAt)}</span>
      </div>
      <Button
        size="sm"
        type="button"
        variant="destructive"
        onclick={() => {
          onDelete(client);
        }}
      >
        <TrashIcon data-icon="inline-start" />
        <span>{copy.deleteClient}</span>
      </Button>
    </Card.Footer>
  </Card.Root>
</article>
