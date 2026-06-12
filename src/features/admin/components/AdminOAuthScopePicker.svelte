<script lang="ts">
import { Checkbox } from "$lib/components/ui/checkbox/index.js";
import type {
  AuthPatternOption,
  ScopeOption,
} from "./admin-oauth-create-types";

export let copy: Record<string, string>;
export let oauthCopy: (key: string) => string;
export let scopeCountLabel: (count: number) => string;
export let scopeLabel: (scope: string) => string;
export let scopeOptions: ScopeOption[];
export let selectedAuthPattern: AuthPatternOption;
export let selectedScopes: string[];
export let toggleScope: (scope: string, checked: boolean) => void;
</script>

<fieldset class="rounded-md border border-base-300 bg-base-200/40 p-4">
  <div class="flex flex-wrap items-center justify-between gap-2">
    <legend class="font-medium text-sm">{copy.permissionsTitle}</legend>
    <span class="text-base-content/60 text-xs" aria-live="polite">
      {scopeCountLabel(selectedScopes.length)}
    </span>
  </div>
  <p class="mt-1 text-base-content/60 text-xs">{copy.permissionsHint}</p>
  <div class="mt-3 grid gap-3">
    {#each scopeOptions as scope}
      <label
        class={`flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors ${selectedScopes.includes(scope.value) ? "border-primary bg-primary/5" : "border-base-300 bg-base-100 hover:bg-base-200/70"}`}
      >
        <Checkbox
          checked={selectedScopes.includes(scope.value)}
          onchange={(event) => toggleScope(scope.value, event.currentTarget.checked)}
        />
        <span class="min-w-0">
          <span class="block font-mono font-medium text-sm">{scopeLabel(scope.value)}</span>
          <span class="mt-1 block text-base-content/60 text-xs leading-5">
            {oauthCopy(scope.descriptionKey)}
          </span>
        </span>
      </label>
    {/each}
  </div>
  {#each selectedScopes as scope}
    <input type="hidden" name="scopes" value={scope} />
  {/each}
  <div class="mt-4 rounded-md border border-base-300 border-dashed bg-base-100 p-3">
    <p class="font-medium text-sm">{oauthCopy(selectedAuthPattern.titleKey)}</p>
    <p class="mt-1 text-base-content/60 text-xs leading-5">
      {oauthCopy(selectedAuthPattern.hintKey)}
    </p>
  </div>
</fieldset>
