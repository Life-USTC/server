<script lang="ts">
import ShieldAlert from "@lucide/svelte/icons/shield-alert";
import * as Alert from "$lib/components/ui/alert/index.js";
import { Badge } from "$lib/components/ui/badge/index.js";
import * as Card from "$lib/components/ui/card/index.js";
import * as Item from "$lib/components/ui/item/index.js";

export let deviceTitle: string;
export let sideNoteLabel: string;
</script>

<Card.Header class="content-between gap-8 border-border border-b bg-muted/30 p-6 lg:border-r lg:border-b-0">
  <div class="grid gap-5">
    <Item.Root variant="muted">
      <Item.Media class="size-12" variant="image">
        <img class="size-full object-cover" src="/images/icon.png" alt="Life@USTC" />
      </Item.Media>
      <Item.Content class="gap-1">
        <Badge class="w-fit" variant="secondary">OAuth</Badge>
        <Item.Title>{deviceTitle}</Item.Title>
      </Item.Content>
    </Item.Root>
  </div>

  <Alert.Root>
    <ShieldAlert />
    <Alert.Description class="break-words">{sideNoteLabel}</Alert.Description>
  </Alert.Root>
</Card.Header>
