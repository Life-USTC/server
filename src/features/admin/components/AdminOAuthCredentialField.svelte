<script lang="ts">
import CopyIcon from "$lib/components/icons/copy.svelte";
import { Button } from "$lib/components/ui/button/index.js";

export let copyLabel = "";
export let copiedMessage = "";
export let copyText: (value: string, message: string) => void;
export let label: string;
export let showCopy = true;
export let value: string;
</script>

<div class="rounded-md border border-base-300 bg-base-200/40 p-3">
  <div class="font-medium text-sm">{label}</div>
  <p class="break-all font-mono text-sm">{value}</p>
  {#if showCopy}
    <Button class="mt-2" size="sm" type="button" variant="outline" onclick={() => copyText(value, copiedMessage)}>
      <CopyIcon />
      <span>{copyLabel}</span>
    </Button>
  {/if}
</div>
