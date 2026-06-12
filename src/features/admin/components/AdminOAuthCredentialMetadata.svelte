<script lang="ts">
import { Badge } from "$lib/components/ui/badge/index.js";

export let clientTypeLabel: (method: string) => string;
export let copy: Record<string, string>;
export let redirectUris: string[];
export let scopes: string[];
export let scopeLabel: (scope: string) => string;
export let tokenEndpointAuthMethod: string | null | undefined;
export let trusted: boolean | null | undefined;
</script>

<div class="rounded-md border border-base-300 bg-base-200/40 p-3 text-sm">
  <div class="font-medium">{copy.clientType}</div>
  <div class="mt-2 flex flex-wrap gap-1.5">
    <Badge variant="ghost">
      {clientTypeLabel(tokenEndpointAuthMethod ?? "client_secret_basic")}
    </Badge>
    {#if trusted}
      <Badge variant="outline">{copy.clientTrustTrusted}</Badge>
    {/if}
  </div>
</div>
<div class="rounded-md border border-base-300 bg-base-200/40 p-3 text-sm">
  <div class="font-medium">{copy.permissionsTitle}</div>
  <div class="mt-2 flex flex-wrap gap-1.5">
    {#each scopes as scope}
      <Badge class="font-mono" variant="ghost">{scopeLabel(scope)}</Badge>
    {:else}
      <span class="text-base-content/60">{copy.notAvailable}</span>
    {/each}
  </div>
</div>
<div class="rounded-md border border-base-300 bg-base-200/40 p-3 text-sm">
  <div class="font-medium">{copy.redirectUris}</div>
  <div class="mt-2 grid gap-1">
    {#each redirectUris as uri}
      <p class="break-all font-mono text-base-content/70 text-xs">{uri}</p>
    {:else}
      <p class="text-base-content/60">{copy.notAvailable}</p>
    {/each}
  </div>
</div>
