<script lang="ts">
import CopyIcon from "$lib/components/icons/copy.svelte";
import { Button } from "$lib/components/ui/button/index.js";
import * as Item from "$lib/components/ui/item/index.js";

export let copyLabel = "";
export let copiedMessage = "";
export let copyText: (value: string, message: string) => void;
export let label: string;
export let showCopy = true;
export let value: string;
</script>

<Item.Root variant="muted">
  <Item.Content class="min-w-0">
    <Item.Title>{label}</Item.Title>
    <p class="break-all font-mono text-sm">{value}</p>
  </Item.Content>
  {#if showCopy}
    <Item.Actions>
      <Button size="sm" type="button" variant="outline" onclick={() => copyText(value, copiedMessage)}>
        <CopyIcon data-icon="inline-start" />
        <span>{copyLabel}</span>
      </Button>
    </Item.Actions>
  {/if}
</Item.Root>
