<script lang="ts">
import { Badge } from "$lib/components/ui/badge/index.js";
import * as Card from "$lib/components/ui/card/index.js";
import * as Item from "$lib/components/ui/item/index.js";
</script>

<Card.Header class="bg-subtle p-6">
  <Item.Root variant="muted">
    <Item.Media class="size-12" variant="image">
      <img class="size-full object-cover" src="/images/icon.png" alt="" />
    </Item.Media>
    <Item.Content class="gap-1">
      <Badge class="w-fit" variant="secondary">OAuth</Badge>
      <Item.Title>Life@USTC</Item.Title>
    </Item.Content>
  </Item.Root>
</Card.Header>
