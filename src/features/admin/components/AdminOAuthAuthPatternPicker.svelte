<script lang="ts">
import { Badge } from "$lib/components/ui/badge/index.js";
import * as Field from "$lib/components/ui/field/index.js";
import * as ToggleGroup from "$lib/components/ui/toggle-group/index.js";
import type { AuthPatternOption } from "./admin-oauth-create-types";

export let authPatterns: AuthPatternOption[];
export let copy: Record<string, string>;
export let oauthCopy: (key: string) => string;
export let selectedAuthMethod: string;
</script>

<Field.Set>
  <Field.Legend id="admin-oauth-auth-pattern-label">
    {copy.createFlowTitle}
  </Field.Legend>
  <Field.Description>{copy.createFlowIntro}</Field.Description>
  <ToggleGroup.Root
    aria-labelledby="admin-oauth-auth-pattern-label"
    class="grid w-full gap-3 xl:grid-cols-3"
    spacing={3}
    type="single"
    value={selectedAuthMethod}
    variant="outline"
    onValueChange={(value) => {
      if (typeof value === "string" && value) selectedAuthMethod = value;
    }}
  >
    {#each authPatterns as option}
      <ToggleGroup.Item
        class="h-auto w-full justify-between whitespace-normal p-3 text-left"
        value={option.value}
      >
        <Field.Content>
          <div class="flex flex-wrap items-center gap-2">
            <Field.Title>{oauthCopy(option.titleKey)}</Field.Title>
            <Badge variant="outline">{oauthCopy(option.labelKey)}</Badge>
          </div>
          <Field.Description>
            {oauthCopy(option.descriptionKey)}
          </Field.Description>
        </Field.Content>
      </ToggleGroup.Item>
    {/each}
  </ToggleGroup.Root>
  <input type="hidden" name="tokenEndpointAuthMethod" value={selectedAuthMethod} />
</Field.Set>
