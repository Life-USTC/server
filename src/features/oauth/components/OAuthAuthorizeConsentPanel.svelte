<script lang="ts">
import CheckCircle from "@lucide/svelte/icons/check-circle";
import type { SubmitFunction } from "@sveltejs/kit";
import { oauthScopeCountLabel } from "@/features/admin/lib/oauth-controller";
import OAuthScopesPicker from "@/features/oauth/components/OAuthScopesPicker.svelte";
import { buildOAuthScopesPickerCopy } from "@/features/oauth/lib/oauth-scopes-picker-copy";
import { enhance } from "$app/forms";
import { Button } from "$lib/components/ui/button/index.js";
import { Spinner } from "$lib/components/ui/spinner/index.js";

export let copy: Record<string, string>;
export let locale: string = "zh-cn";
export let oauthQuery: string;
export let scope: string;
export let scopes: Array<{ label: string; value: string }>;

let scopeKey = "";
let selectedScopes: string[] = [];
let pendingDecision: "allow" | "deny" | null = null;

function consentAction(decision: "allow" | "deny"): SubmitFunction {
  return () => {
    pendingDecision = decision;
    return async ({ update }) => {
      try {
        await update({ reset: false });
      } finally {
        pendingDecision = null;
      }
    };
  };
}

$: {
  const nextScopeKey = scopes.map((scopeItem) => scopeItem.value).join(" ");
  if (nextScopeKey !== scopeKey) {
    scopeKey = nextScopeKey;
    selectedScopes = scopes.map((scopeItem) => scopeItem.value);
  }
}

$: scopesPickerCopy = buildOAuthScopesPickerCopy(copy, {
  selectedCountLabel: oauthScopeCountLabel(selectedScopes.length, locale),
  title: copy.scopesLabel,
});

$: selectedScopeValue = selectedScopes.join(" ");
$: canAllow = scopes.length === 0 || selectedScopes.length > 0;
</script>

{#if scopes.length > 0}
  <OAuthScopesPicker
    copy={scopesPickerCopy}
    idPrefix="oauth-consent-scope"
    items={scopes}
    {selectedScopes}
    onSelectedChange={(next) => {
      selectedScopes = next;
    }}
  />
{:else}
  <p class="text-muted-foreground text-sm">{copy.scopesLabel}</p>
{/if}

<div class="grid gap-3 sm:grid-cols-2">
  <form method="POST" action="?/consent" use:enhance={consentAction("deny")}>
    <input type="hidden" name="accept" value="false" />
    <input type="hidden" name="scope" value={scope} />
    <input type="hidden" name="oauthQuery" value={oauthQuery} />
    <Button class="w-full" disabled={Boolean(pendingDecision)} type="submit" variant="outline">
      {#if pendingDecision === "deny"}<Spinner data-icon="inline-start" />{/if}
      {copy.deny}
    </Button>
  </form>
  <form method="POST" action="?/consent" use:enhance={consentAction("allow")}>
    <input type="hidden" name="accept" value="true" />
    <input type="hidden" name="scope" value={selectedScopeValue || scope} />
    <input type="hidden" name="scopeSelectionEnabled" value="true" />
    {#each selectedScopes as selectedScope}
      <input type="hidden" name="scopes" value={selectedScope} />
    {/each}
    <input type="hidden" name="oauthQuery" value={oauthQuery} />
    <Button class="w-full" disabled={!canAllow || Boolean(pendingDecision)} type="submit">
      {#if pendingDecision === "allow"}
        <Spinner data-icon="inline-start" />
      {:else}
        <CheckCircle data-icon="inline-start" />
      {/if}
      {copy.allow}
    </Button>
  </form>
</div>
