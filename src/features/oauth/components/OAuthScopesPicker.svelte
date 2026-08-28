<script lang="ts">
import {
  allPickerScopeValues,
  buildOAuthScopePickerGroups,
  defaultOAuthFeatureLabel,
  type OAuthScopeListItem,
  type OAuthScopePickerGroup,
  scopesInPickerGroup,
} from "@/features/oauth/lib/oauth-scope-groups";
import type { OAuthScopesPickerCopy } from "@/features/oauth/lib/oauth-scopes-picker-copy";
import { Button } from "$lib/components/ui/button/index.js";
import { Checkbox } from "$lib/components/ui/checkbox/index.js";
import * as Field from "$lib/components/ui/field/index.js";

export let copy: OAuthScopesPickerCopy;
export let idPrefix = "oauth-scope";
export let items: OAuthScopeListItem[];
export let selectedScopes: string[];
export let onSelectedChange: (next: string[]) => void;

$: groups = buildOAuthScopePickerGroups(items, {
  featureLabel: (feature) =>
    copy.featureLabels?.[feature] ?? defaultOAuthFeatureLabel(feature),
  groupTitle: (groupId) => copy.groupTitles[groupId] ?? groupId,
});
$: availableScopes = allPickerScopeValues(groups);
$: allSelected =
  availableScopes.length > 0 &&
  availableScopes.every((scope) => selectedScopes.includes(scope));

function checkboxId(value: string) {
  return `${idPrefix}-${value.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

function setScope(value: string, checked: boolean) {
  onSelectedChange(
    checked
      ? Array.from(new Set([...selectedScopes, value]))
      : selectedScopes.filter((scope) => scope !== value),
  );
}

function setScopes(values: string[], checked: boolean) {
  if (checked) {
    onSelectedChange(Array.from(new Set([...selectedScopes, ...values])));
    return;
  }
  const drop = new Set(values);
  onSelectedChange(selectedScopes.filter((scope) => !drop.has(scope)));
}

function toggleAuthorizeAll() {
  setScopes(availableScopes, !allSelected);
}

function groupFullySelected(group: OAuthScopePickerGroup) {
  const values = scopesInPickerGroup(group);
  return (
    values.length > 0 && values.every((scope) => selectedScopes.includes(scope))
  );
}

function toggleGroup(group: OAuthScopePickerGroup) {
  setScopes(scopesInPickerGroup(group), !groupFullySelected(group));
}
</script>

<Field.Set>
  <div class="flex flex-wrap items-center justify-between gap-2">
    {#if copy.title}
      <Field.Legend variant="label">{copy.title}</Field.Legend>
    {/if}
    <div class="flex flex-wrap items-center gap-2">
      <Field.Description aria-live="polite" class="m-0">
        {copy.selectedCountLabel}
      </Field.Description>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={availableScopes.length === 0}
        onclick={toggleAuthorizeAll}
      >
        {allSelected ? copy.clearAll : copy.authorizeAll}
      </Button>
    </div>
  </div>
  {#if copy.hint}
    <Field.Description>{copy.hint}</Field.Description>
  {/if}

  <div class="grid gap-4">
    {#each groups as group}
      {@const groupValues = scopesInPickerGroup(group)}
      <Field.Set
        class="grid grid-cols-[minmax(0,1fr)_auto] gap-2 rounded-lg border p-3"
      >
        <Field.Legend class="font-medium text-sm">{group.title}</Field.Legend>
        <Button
          class="justify-self-end"
          type="button"
          size="sm"
          variant="ghost"
          disabled={groupValues.length === 0}
          onclick={() => toggleGroup(group)}
        >
          {copy.groupSelectAll}
        </Button>

        <Field.Group class="col-span-2 gap-2">
          {#each group.rows as row}
            {#if row.kind === "base"}
              {@const scopeId = checkboxId(row.value)}
              <Field.Field orientation="horizontal" class="items-center">
                <Checkbox
                  id={scopeId}
                  checked={selectedScopes.includes(row.value)}
                  onCheckedChange={(checked) => setScope(row.value, checked)}
                />
                <Field.Label class="cursor-pointer font-normal" for={scopeId}>
                  {row.label}
                </Field.Label>
              </Field.Field>
            {:else}
              <div
                class="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 sm:gap-3"
              >
                <p class="min-w-0 truncate text-sm">{row.featureLabel}</p>
                {#if row.read}
                  {@const readId = checkboxId(row.read.value)}
                  <label
                    class="flex cursor-pointer items-center gap-1.5 text-xs"
                    for={readId}
                    title={row.read.label}
                  >
                    <Checkbox
                      id={readId}
                      checked={selectedScopes.includes(row.read.value)}
                      onCheckedChange={(checked) =>
                        setScope(row.read!.value, checked)}
                    />
                    <span>{copy.read}</span>
                  </label>
                {:else}
                  <span class="text-muted-foreground text-xs">—</span>
                {/if}
                {#if row.write}
                  {@const writeId = checkboxId(row.write.value)}
                  <label
                    class="flex cursor-pointer items-center gap-1.5 text-xs"
                    for={writeId}
                    title={row.write.label}
                  >
                    <Checkbox
                      id={writeId}
                      checked={selectedScopes.includes(row.write.value)}
                      onCheckedChange={(checked) =>
                        setScope(row.write!.value, checked)}
                    />
                    <span>{copy.write}</span>
                  </label>
                {:else}
                  <span class="text-muted-foreground text-xs">—</span>
                {/if}
              </div>
            {/if}
          {/each}
        </Field.Group>
      </Field.Set>
    {/each}
  </div>
</Field.Set>
