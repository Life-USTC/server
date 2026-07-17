<script lang="ts">
import type { DashboardFocusItem } from "@/features/dashboard/lib/dashboard-agenda";
import { Badge } from "$lib/components/ui/badge/index.js";
import * as Card from "$lib/components/ui/card/index.js";
import * as Empty from "$lib/components/ui/empty/index.js";
import * as Item from "$lib/components/ui/item/index.js";

export let copy: {
  next: string;
  noUpcoming: string;
  now: string;
  title: string;
  urgent: string;
};
export let focus: DashboardFocusItem | null;

function statusLabel(status: DashboardFocusItem["status"]) {
  if (status === "now") return copy.now;
  if (status === "urgent") return copy.urgent;
  return copy.next;
}
</script>

<Card.Root data-testid="dashboard-overview-focus">
  <Card.Header>
    <Card.Title>{copy.title}</Card.Title>
  </Card.Header>
  <Card.Content>
    {#if focus}
      <Item.Root variant="outline">
        {#snippet child({ props })}
          <a href={focus.href} {...props}>
            <Item.Content>
              <div class="flex flex-wrap items-center gap-2">
                <Badge variant={focus.status === "urgent" ? "destructive" : "secondary"}>
                  {statusLabel(focus.status)}
                </Badge>
                <span class="text-xs text-muted-foreground">
                  {focus.weekdayLabel} · {focus.dateLabel}
                </span>
              </div>
              <Item.Title class="text-base">{focus.title}</Item.Title>
              <Item.Description>
                {focus.label}{focus.meta ? ` · ${focus.meta}` : ""}
              </Item.Description>
            </Item.Content>
          </a>
        {/snippet}
      </Item.Root>
    {:else}
      <Empty.Root class="items-start py-2 text-left">
        <Empty.Header class="items-start text-left">
          <Empty.Title>{copy.noUpcoming}</Empty.Title>
        </Empty.Header>
      </Empty.Root>
    {/if}
  </Card.Content>
</Card.Root>
