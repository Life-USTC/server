<script lang="ts">
import { Badge } from "$lib/components/ui/badge/index.js";
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
  <RadioGroup.Root bind:value={selectedAuthMethod} class="grid gap-3 xl:grid-cols-3">
    {#each authPatterns as option}
      <RadioGroup.Item
        class={`p-4 text-left ${selectedAuthMethod === option.value ? "border-primary bg-primary/5 ring-primary/25" : "bg-base-100 hover:bg-base-200/70"}`}
        value={option.value}
      >
        <div class="flex flex-wrap items-center gap-2">
          <span class="font-semibold text-sm">{oauthCopy(option.titleKey)}</span>
          <Badge variant="outline">{oauthCopy(option.labelKey)}</Badge>
        </div>
        <p class="mt-2 text-base-content/65 text-xs leading-5">
          {oauthCopy(option.descriptionKey)}
        </p>
      </RadioGroup.Item>
    {/each}
  </RadioGroup.Root>
  <input type="hidden" name="tokenEndpointAuthMethod" value={selectedAuthMethod} />
</section>
