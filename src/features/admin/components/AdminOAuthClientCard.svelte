<script lang="ts">
import CopyIcon from "$lib/components/icons/copy.svelte";
import TrashIcon from "$lib/components/icons/trash-2.svelte";
import { Badge } from "$lib/components/ui/badge/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import type { AdminOAuthClient } from "./admin-oauth-client-types";

export let client: AdminOAuthClient;
export let clientAuthCopy: (method: string) => string;
export let clientTypeLabel: (method: string) => string;
export let copy: Record<string, string>;
export let copyText: (value: string, message: string) => void;
export let formatCreatedAt: (value: string | Date) => string;
export let onDelete: (client: AdminOAuthClient) => void;
</script>

<article class="rounded-md border border-base-300 border-l-4 border-l-primary bg-base-100 p-4" data-slot="card">
  <div class="grid gap-4">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div class="min-w-0">
        <h3 class="font-semibold text-lg">{client.name ?? copy.unnamedClient}</h3>
        <p class="mt-1 break-all font-mono text-base-content/60 text-xs">{client.clientId}</p>
      </div>
      <div class="flex flex-wrap gap-2">
        <Badge variant="ghost">{clientTypeLabel(client.tokenEndpointAuthMethod)}</Badge>
        {#if client.skipConsent}<Badge class="border-warning bg-warning/10 text-warning" variant="outline">{copy.clientTrustTrusted}</Badge>{/if}
        {#if client.disabled}
          <Badge class="border-error bg-error/10 text-error" variant="outline">{copy.disabled}</Badge>
        {:else}
          <Badge class="border-success bg-success/10 text-success" variant="outline">{copy.enabled}</Badge>
        {/if}
      </div>
    </div>

    <div class="grid gap-3 text-sm lg:grid-cols-[220px_1fr_1fr]">
      <div class="rounded-md border border-base-300 bg-base-200/40 p-3">
        <div class="text-base-content/60 text-xs">{copy.clientType}</div>
        <div class="mt-1 font-medium">{clientTypeLabel(client.tokenEndpointAuthMethod)}</div>
        <p class="mt-1 text-base-content/60 text-xs">{clientAuthCopy(client.tokenEndpointAuthMethod)}</p>
      </div>
      <div class="rounded-md border border-base-300 bg-base-200/40 p-3">
        <div class="font-medium">{copy.redirectUris}</div>
        <div class="mt-2 grid gap-1">
          {#each client.redirectUris as uri}
            <div class="flex items-start gap-2">
              <p class="min-w-0 flex-1 break-all font-mono text-base-content/70 text-xs">{uri}</p>
              <Button
                aria-label={copy.copyRedirectUri}
                class="shrink-0"
                size="sm"
                type="button"
                variant="ghost"
                onclick={() => copyText(uri, copy.redirectUriCopied)}
              >
                <CopyIcon />
                <span>{copy.copyRedirectUri}</span>
              </Button>
            </div>
          {:else}
            <p class="text-base-content/60">{copy.notAvailable}</p>
          {/each}
        </div>
      </div>
      <div class="rounded-md border border-base-300 bg-base-200/40 p-3">
        <div class="font-medium">{copy.tableColumnScopes}</div>
        <div class="mt-2 flex flex-wrap gap-1.5">
          {#each client.scopes as scope}
            <Badge class="font-mono" variant="ghost">{scope}</Badge>
          {:else}
            <span class="text-base-content/60">{copy.notAvailable}</span>
          {/each}
        </div>
      </div>
    </div>

    <div class="flex flex-wrap items-center justify-between gap-3 border-base-300 border-t pt-3">
      <div class="flex flex-wrap gap-2">
        <Button size="sm" type="button" variant="outline" onclick={() => copyText(client.clientId, copy.clientIdCopied)}>
          <CopyIcon />
          <span>{copy.copyClientId}</span>
        </Button>
        <span class="self-center text-base-content/50 text-xs">{copy.createdAtLabel} {formatCreatedAt(client.createdAt)}</span>
      </div>
      <Button
        class="border-transparent bg-error text-error-content hover:bg-error/90"
        size="sm"
        type="button"
        onclick={() => {
          onDelete(client);
        }}
      >
        <TrashIcon />
        <span>{copy.deleteClient}</span>
      </Button>
    </div>
  </div>
</article>
