<script lang="ts">
import CopyIcon from "@lucide/svelte/icons/copy";
import { Button } from "#lib/components/ui/button/index.js";
import * as Item from "#lib/components/ui/item/index.js";

export let copyLabel = "";
export let copiedMessage = "";
export let copyText: (value: string, message: string) => unknown;
export let label: string;
export let showCopy = true;
export let value: string;
</script>

<Item.Root variant="muted">
  <Item.Content class="min-w-0">
    <Item.Title>{label}</Item.Title>
    <Item.Description class="break-all font-mono">{value}</Item.Description>
  </Item.Content>
  {#if showCopy}
    <Item.Actions>
      <Button icon={CopyIcon} variant="outline" onclick={() => copyText(value, copiedMessage)}>
        <span>{copyLabel}</span>
      </Button>
    </Item.Actions>
  {/if}
</Item.Root>
