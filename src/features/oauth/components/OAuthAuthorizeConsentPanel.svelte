<script lang="ts">
import CheckCircle from "$lib/components/icons/check-circle.svelte";
import ShieldAlert from "$lib/components/icons/shield-alert.svelte";
import { Badge } from "$lib/components/ui/badge/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import { Checkbox } from "$lib/components/ui/checkbox/index.js";

export let copy: Record<string, string>;
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

function toggleScope(value: string, checked: boolean) {
  selectedScopes = checked
    ? Array.from(new Set([...selectedScopes, value]))
    : selectedScopes.filter((selectedScope) => selectedScope !== value);
}

$: selectedScopeValue = selectedScopes.join(" ");
$: canAllow = scopes.length === 0 || selectedScopes.length > 0;
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
        <li>
          <label
            class={`grid min-w-0 cursor-pointer gap-2 rounded-md border p-3 text-left transition-colors sm:grid-cols-[auto_auto_minmax(0,1fr)] sm:items-start ${selectedScopes.includes(scopeItem.value) ? "border-primary bg-primary/5" : "border-base-300 bg-base-100 hover:bg-base-200/70"}`}
          >
            <Checkbox
              checked={selectedScopes.includes(scopeItem.value)}
              onchange={(event) => toggleScope(scopeItem.value, event.currentTarget.checked)}
            />
            <Badge class="mt-0.5 max-w-full whitespace-normal break-all font-mono text-left" variant="outline">{scopeItem.value}</Badge>
            <span class="min-w-0 break-words text-base-content/70">{scopeItem.label}</span>
          </label>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<div class="grid grid-cols-2 gap-3">
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
      <CheckCircle />
      {copy.allow}
    </Button>
  </form>
</div>
