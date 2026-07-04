<script lang="ts">
import CheckCircle from "$lib/components/icons/check-circle.svelte";
import ShieldAlert from "$lib/components/icons/shield-alert.svelte";
import { Badge } from "$lib/components/ui/badge/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import { Checkbox } from "$lib/components/ui/checkbox/index.js";
import * as Field from "$lib/components/ui/field/index.js";

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

function scopeCheckboxId(value: string) {
  return `oauth-scope-${value.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

$: selectedScopeValue = selectedScopes.join(" ");
$: canAllow = scopes.length === 0 || selectedScopes.length > 0;
</script>

<div class="rounded-md border border-base-300 bg-base-200/40 p-4">
  <Field.FieldSet>
    <Field.FieldLegend class="flex min-w-0 items-center gap-2" variant="label">
      <ShieldAlert />
      <span class="min-w-0 break-words">{copy.scopesLabel}</span>
    </Field.FieldLegend>
    {#if scopes.length > 0}
      <Field.FieldGroup class="gap-2">
        {#each scopes as scopeItem}
          {@const checkboxId = scopeCheckboxId(scopeItem.value)}
          <Field.Field
            class="rounded-md border border-base-300 bg-base-100 p-3 transition-colors hover:bg-base-200/60"
            orientation="horizontal"
          >
            <Checkbox
              id={checkboxId}
              checked={selectedScopes.includes(scopeItem.value)}
              onCheckedChange={(checked) => toggleScope(scopeItem.value, checked)}
            />
            <Field.Content>
              <Field.Label
                class="w-full cursor-pointer flex-wrap items-start gap-2 font-normal"
                for={checkboxId}
              >
                <Badge class="max-w-full whitespace-normal break-all font-mono text-left" variant="outline">{scopeItem.value}</Badge>
                <span class="min-w-0 break-words text-base-content/70">{scopeItem.label}</span>
              </Field.Label>
            </Field.Content>
          </Field.Field>
        {/each}
      </Field.FieldGroup>
    {/if}
  </Field.FieldSet>
</div>

<div class="grid gap-3 sm:grid-cols-2">
  <form method="POST" action="?/consent">
    <input type="hidden" name="accept" value="false" />
    <input type="hidden" name="scope" value={scope} />
    <input type="hidden" name="oauthQuery" value={oauthQuery} />
    <Button class="h-10 w-full" type="submit" variant="outline">
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
    <Button class="h-10 w-full" disabled={!canAllow} type="submit">
      <CheckCircle data-icon="inline-start" />
      {copy.allow}
    </Button>
  </form>
</div>
