<script lang="ts">
import type { SubmitFunction } from "@sveltejs/kit";
import { enhance } from "$app/forms";
import CheckCircle from "$lib/components/icons/check-circle.svelte";
import RefreshCw from "$lib/components/icons/refresh-cw.svelte";
import ShieldAlert from "$lib/components/icons/shield-alert.svelte";
import { Badge } from "$lib/components/ui/badge/index.js";
import { Button } from "$lib/components/ui/button/index.js";

export let consentAction: (decision: "allow" | "deny") => SubmitFunction;
export let copy: Record<string, string>;
export let oauthQuery: string;
export let pendingConsent: "allow" | "deny" | null;
export let scope: string;
export let scopes: Array<{ label: string; value: string }>;
</script>

<div class="min-w-0 text-center">
  <Badge class="mb-3" variant="ghost">OAuth</Badge>
  <h2 class="font-semibold text-2xl tracking-normal">{copy.title}</h2>
  <p class="mt-2 break-words text-base-content/70 text-sm">
    {copy.description}
  </p>
</div>

<div class="min-w-0 rounded-md border border-base-300 bg-base-200/50 p-4">
  <p class="flex min-w-0 items-center gap-2 font-medium text-sm">
    <ShieldAlert />
    <span class="min-w-0 break-words">{copy.scopesLabel}</span>
  </p>
  {#if scopes.length > 0}
    <ul class="mt-3 grid gap-2 text-sm">
      {#each scopes as scopeItem}
        <li class="grid min-w-0 gap-1 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-start sm:gap-2">
          <Badge class="mt-0.5 max-w-full whitespace-normal break-all font-mono text-left" variant="outline">{scopeItem.value}</Badge>
          <span class="min-w-0 break-words text-base-content/70">{scopeItem.label}</span>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<div class="grid grid-cols-2 gap-3">
  <form method="POST" action="?/consent" use:enhance={consentAction("deny")}>
    <input type="hidden" name="accept" value="false" />
    <input type="hidden" name="scope" value={scope} />
    <input type="hidden" name="oauthQuery" value={oauthQuery} />
    <Button class="w-full" disabled={Boolean(pendingConsent)} type="submit" variant="outline">
      {#if pendingConsent === "deny"}<RefreshCw class="animate-spin" />{/if}
      {copy.deny}
    </Button>
  </form>
  <form method="POST" action="?/consent" use:enhance={consentAction("allow")}>
    <input type="hidden" name="accept" value="true" />
    <input type="hidden" name="scope" value={scope} />
    <input type="hidden" name="oauthQuery" value={oauthQuery} />
    <Button class="w-full" disabled={Boolean(pendingConsent)} type="submit">
      {#if pendingConsent === "allow"}
        <RefreshCw class="animate-spin" />
        {copy.authorizing}
      {:else}
        <CheckCircle />
        {copy.allow}
      {/if}
    </Button>
  </form>
</div>
