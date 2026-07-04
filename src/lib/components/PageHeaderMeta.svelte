<script lang="ts">
import * as Item from "$lib/components/ui/item/index.js";
import { cn } from "$lib/utils.js";

export let label: string;
export let value: string | number;
let className = "";

export { className as class };
</script>

<Item.Root
  class={cn("w-auto min-w-40 items-start", className)}
  size="sm"
  variant="muted"
>
  <Item.Content>
    <Item.Description>{label}</Item.Description>
    <Item.Title>{value}</Item.Title>
  </Item.Content>
</Item.Root>
