<script lang="ts">
import { Badge } from "$lib/components/ui/badge/index.js";
import * as Field from "$lib/components/ui/field/index.js";
import * as RadioGroup from "$lib/components/ui/radio-group/index.js";
import type { AuthPatternOption } from "./admin-oauth-create-types";

export let authPatterns: AuthPatternOption[];
export let copy: Record<string, string>;
export let oauthCopy: (key: string) => string;
export let selectedAuthMethod: string;
</script>

<section class="grid gap-3">
  <div>
    <h3 class="font-semibold text-sm">{copy.createFlowTitle}</h3>
    <p class="mt-1 text-base-content/60 text-sm">{copy.createFlowIntro}</p>
  </div>
  <RadioGroup.Root
    aria-label={copy.createFlowTitle}
    bind:value={selectedAuthMethod}
    class="grid gap-3 xl:grid-cols-3"
  >
    {#each authPatterns as option}
      {@const optionId = `token-endpoint-auth-method-${option.value}`}
      <Field.Label class="h-full" for={optionId}>
        <Field.Field class="h-full justify-between" orientation="horizontal">
          <Field.Content>
            <div class="flex flex-wrap items-center gap-2">
              <Field.Title>{oauthCopy(option.titleKey)}</Field.Title>
              <Badge variant="outline">{oauthCopy(option.labelKey)}</Badge>
            </div>
            <Field.Description>
              {oauthCopy(option.descriptionKey)}
            </Field.Description>
          </Field.Content>
          <RadioGroup.Item id={optionId} value={option.value} />
        </Field.Field>
      </Field.Label>
    {/each}
  </RadioGroup.Root>
  <input type="hidden" name="tokenEndpointAuthMethod" value={selectedAuthMethod} />
</section>
