<script lang="ts">
import CheckCircleIcon from "$lib/components/icons/check-circle.svelte";
import LinkIcon from "$lib/components/icons/link-2.svelte";
import { Button } from "$lib/components/ui/button/index.js";

export let buttonLabel: string;
export let copied: boolean;
export let copiedLabel: string;
export let id: string;
export let label: string;
export let missingLabel = "";
export let onCopy: () => void | Promise<void>;
export let value: string;
</script>

<div
  class="grid min-w-0 gap-2 rounded-lg border border-base-300 p-3 sm:grid-cols-[minmax(0,1fr)_auto]"
>
  <label class="font-medium text-sm" for={id}>
    {label}
  </label>
  <span class="hidden sm:block"></span>
  <div class="min-w-0">
    <input
      {id}
      class="h-9 min-w-0 w-full overflow-hidden text-ellipsis whitespace-nowrap rounded-md border border-base-300 bg-base-100 px-3 py-2 text-sm shadow-sm disabled:text-base-content/60"
      disabled={!value}
      readonly
      title={value || missingLabel}
      value={value || missingLabel}
    />
  </div>
  <Button
    class="whitespace-nowrap"
    variant="outline"
    disabled={!value}
    type="button"
    onclick={onCopy}
  >
    {#if copied}
      <CheckCircleIcon />
      {copiedLabel}
    {:else}
      <LinkIcon />
      {buttonLabel}
    {/if}
  </Button>
</div>
