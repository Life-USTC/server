<script lang="ts">
import { Badge } from "#lib/components/ui/badge/index.js";
import { Button } from "#lib/components/ui/button/index.js";
import * as Item from "#lib/components/ui/item/index.js";
import { WORKSPACE_OVERVIEW_PREVIEW_LIMIT } from "@/features/workspace/lib/overview-preview";
import type { OverviewStackItem } from "@/features/workspace/lib/overview-stack";
import OverviewSection from "./OverviewSection.svelte";

let {
  testId,
  title,
  items,
  destinations,
  viewAllLabel,
}: {
  testId: string;
  title: string;
  items: OverviewStackItem[];
  destinations: Array<{ href: string; label: string }>;
  viewAllLabel: string;
} = $props();
</script>

<OverviewSection {testId} {title}>
  <Item.Group class="gap-0 min-w-0">
    {#each items.slice(0, WORKSPACE_OVERVIEW_PREVIEW_LIMIT) as item (item.key)}
      <Item.Root class="min-w-0" size="sm">
        {#snippet child({ props })}
          <a href={item.href} data-overview-item={item.key} {...props}>
            <Item.Content class="min-w-0">
              <Item.Title class="break-words">{item.title}</Item.Title>
              <Item.Description class="flex flex-wrap gap-x-2 gap-y-1">
                <span>{item.label}</span>
                {#if item.meta}<span class="tabular-nums">{item.meta}</span>{/if}
                {#if item.badge}<Badge variant="destructive">{item.badge}</Badge>{/if}
              </Item.Description>
              <Item.Description>{item.weekdayLabel} · {item.dateLabel}</Item.Description>
              {#if item.detail}<Item.Description>{item.detail}</Item.Description>{/if}
            </Item.Content>
          </a>
        {/snippet}
      </Item.Root>
    {/each}
  </Item.Group>
  <nav aria-label={`${title} · ${viewAllLabel}`} class="flex flex-wrap items-center gap-x-4 gap-y-1">
    <span class="text-sm text-muted-foreground">{viewAllLabel}</span>
    {#each destinations as destination}
      <Button href={destination.href} variant="link" size="sm" class="px-0">{destination.label}</Button>
    {/each}
  </nav>
</OverviewSection>
