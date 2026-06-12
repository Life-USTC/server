<script lang="ts">
import { Input } from "$lib/components/ui/input/index.js";
import { Textarea } from "$lib/components/ui/textarea/index.js";

export let copy: Record<string, string>;
export let parsedRedirectUris: string[];
export let redirectCountLabel: (count: number) => string;
export let redirectDraft: string;
</script>

<div class="grid content-start gap-4">
  <label class="grid gap-2">
    <span class="font-medium text-sm">{copy.clientName}</span>
    <Input
      name="name"
      autocomplete="off"
      placeholder={copy.clientNamePlaceholder}
      required
    />
  </label>
  <label class="grid gap-2">
    <span class="flex flex-wrap items-center justify-between gap-2">
      <span class="font-medium text-sm">{copy.redirectUris}</span>
      <span class="text-base-content/60 text-xs" aria-live="polite">
        {redirectCountLabel(parsedRedirectUris.length)}
      </span>
    </span>
    <Textarea
      bind:value={redirectDraft}
      class="min-h-32 font-mono text-sm"
      name="redirectUris"
      placeholder={copy.redirectUrisPlaceholder}
      required
    />
    <span class="text-base-content/60 text-xs">{copy.redirectUrisHint}</span>
  </label>
</div>
