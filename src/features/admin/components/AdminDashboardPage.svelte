<script lang="ts">
import {
  type AdminDashboardCardData,
  type AdminDashboardCommonCopy,
  adminDashboardCards,
  adminDashboardQueueCards,
} from "@/features/admin/lib/admin-dashboard-card-data";
import PageHeader from "$lib/components/PageHeader.svelte";
import { Badge } from "$lib/components/ui/badge/index.js";
import * as Item from "$lib/components/ui/item/index.js";

export let data: AdminDashboardCardData & {
  copy: AdminDashboardCardData["copy"] & {
    common: AdminDashboardCommonCopy;
    title: string;
  };
};

$: cards = adminDashboardCards(data);
$: queueCards = adminDashboardQueueCards(data);
</script>

<svelte:head><title>{data.copy.title} - Life@USTC</title></svelte:head>

<section class="grid gap-8">
  <PageHeader title={data.copy.title} description={data.copy.subtitle} />

  <div class="grid gap-3">
    <h2 class="text-sm font-medium text-base-content/60">
      {data.copy.dashboard.openItems}
    </h2>
    <Item.Group class="grid gap-2 sm:grid-cols-3">
      {#each queueCards as queue}
        <Item.Root size="sm" variant="outline">
          {#snippet child({ props })}
            <a {...props} href={queue.href}>
              <Item.Content>
                <Item.Title>{queue.label}</Item.Title>
                <Item.Description>{queue.meta}</Item.Description>
              </Item.Content>
              <Item.Actions>
                <Badge variant="secondary">{queue.value}</Badge>
              </Item.Actions>
            </a>
          {/snippet}
        </Item.Root>
      {/each}
    </Item.Group>
  </div>

  <Item.Group>
    {#each cards as card}
      {@const Icon = card.icon}
      <Item.Root variant="outline">
        {#snippet child({ props })}
          <a {...props} href={card.href}>
            <Item.Media variant="icon">
              <Icon />
            </Item.Media>
            <Item.Content>
              <Item.Title>{card.label}</Item.Title>
              <Item.Description>{card.description}</Item.Description>
            </Item.Content>
            <Item.Actions>
              <Badge variant="outline">{card.value}</Badge>
            </Item.Actions>
            <Item.Footer class="text-muted-foreground text-xs">
              {card.meta}
            </Item.Footer>
          </a>
        {/snippet}
      </Item.Root>
    {/each}
  </Item.Group>
</section>
