<script lang="ts">
import { Badge } from "$lib/components/ui/badge/index.js";
import * as Item from "$lib/components/ui/item/index.js";

export let appName: string;
</script>

<Item.Root class="items-center" variant="muted">
  <Item.Media class="size-11" variant="image">
    <img class="size-full object-cover" src="/images/icon.png" alt="Life@USTC" />
  </Item.Media>
  <Item.Content class="gap-1">
    <Badge class="w-fit" variant="secondary">OAuth</Badge>
    <Item.Title>{appName}</Item.Title>
  </Item.Content>
</Item.Root>
