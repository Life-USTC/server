<script lang="ts">
import CheckCircle from "@lucide/svelte/icons/check-circle";
import { oauthScopeCountLabel } from "@/features/admin/lib/oauth-controller";
import OAuthScopesPicker from "@/features/oauth/components/OAuthScopesPicker.svelte";
import { buildOAuthScopesPickerCopy } from "@/features/oauth/lib/oauth-scopes-picker-copy";
import { Button } from "$lib/components/ui/button/index.js";

export let copy: Record<string, string>;
export let locale: string = "zh-cn";
export let oauthQuery: string;
export let scope: string;
export let scopes: Array<{ label: string; value: string }>;

let scopeKey = "";
let selectedScopes: string[] = [];

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
  <form method="POST" action="?/consent">
    <input type="hidden" name="accept" value="false" />
    <input type="hidden" name="scope" value={scope} />
    <input type="hidden" name="oauthQuery" value={oauthQuery} />
    <Button class="w-full" type="submit" variant="outline">
      {copy.deny}
    </Button>
  </form>
  <form method="POST" action="?/consent">
    <input type="hidden" name="accept" value="true" />
    <input type="hidden" name="scope" value={selectedScopeValue || scope} />
    <input type="hidden" name="scopeSelectionEnabled" value="true" />
    {#each selectedScopes as selectedScope}
      <input type="hidden" name="scopes" value={selectedScope} />
    {/each}
    <input type="hidden" name="oauthQuery" value={oauthQuery} />
    <Button class="w-full" disabled={!canAllow} type="submit">
      <CheckCircle data-icon="inline-start" />
      {copy.allow}
    </Button>
  </form>
</div>
