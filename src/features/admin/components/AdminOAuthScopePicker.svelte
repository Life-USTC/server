<script lang="ts">
import { Checkbox } from "$lib/components/ui/checkbox/index.js";
import * as Field from "$lib/components/ui/field/index.js";
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

<Field.Set>
  <div class="flex flex-wrap items-center justify-between gap-2">
    <Field.Legend variant="label" class="mb-0">
      {copy.permissionsTitle}
    </Field.Legend>
    <Field.Description aria-live="polite">
      {scopeCountLabel(selectedScopes.length)}
    </Field.Description>
  </div>
  <Field.Description>{copy.permissionsHint}</Field.Description>
  <Field.Group class="gap-3">
    {#each scopeOptions as scope}
      {@const scopeId = `admin-oauth-scope-${scope.value.replace(/:/g, "-")}`}
      <Field.Label for={scopeId} class="cursor-pointer">
        <Field.Field orientation="horizontal">
          <Checkbox
            id={scopeId}
            checked={selectedScopes.includes(scope.value)}
            onCheckedChange={(checked) => toggleScope(scope.value, checked)}
          />
          <Field.Content>
            <Field.Title class="font-mono">
              {scopeLabel(scope.value)}
            </Field.Title>
            <Field.Description>
            {oauthCopy(scope.descriptionKey)}
            </Field.Description>
          </Field.Content>
        </Field.Field>
      </Field.Label>
    {/each}
  </Field.Group>
  {#each selectedScopes as scope}
    <input type="hidden" name="scopes" value={scope} />
  {/each}
  <Field.Separator />
  <Field.Field>
    <Field.Title>{oauthCopy(selectedAuthPattern.titleKey)}</Field.Title>
    <Field.Description>
      {oauthCopy(selectedAuthPattern.hintKey)}
    </Field.Description>
  </Field.Field>
</Field.Set>
