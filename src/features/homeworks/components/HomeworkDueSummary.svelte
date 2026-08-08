<script lang="ts">
import type { HomeworkDueSummary } from "@/features/homeworks/lib/homework-detail-meta";
import { Badge } from "$lib/components/ui/badge/index.js";
import * as Item from "$lib/components/ui/item/index.js";

export let summary: HomeworkDueSummary;
</script>

<Item.Root variant="muted" class="items-start">
  <Item.Header>
    <Item.Content>
      <Item.Description>{summary.dueLabel}</Item.Description>
      <Item.Title class="text-base tabular-nums">{summary.dueValue}</Item.Title>
    </Item.Content>
    <Item.Actions>
      <Badge variant={summary.completed ? "default" : "secondary"}>
        {summary.statusLabel}
      </Badge>
    </Item.Actions>
  </Item.Header>
  {#if summary.etaLabel}
    <Item.Description>{summary.etaLabel}</Item.Description>
  {/if}
</Item.Root>
