<script lang="ts">
import { Badge } from "#lib/components/ui/badge/index.js";
import { Button } from "#lib/components/ui/button/index.js";
import * as Item from "#lib/components/ui/item/index.js";
import { cn } from "#lib/utils.js";
import { WORKSPACE_OVERVIEW_PREVIEW_LIMIT } from "@/features/workspace/lib/overview-preview";
import type { OverviewStackItem } from "@/features/workspace/lib/overview-stack";
import OverviewSection from "./OverviewSection.svelte";

let {
  testId,
  title,
  items,
  destinations,
  viewAllLabel,
  class: className = "",
  wide = false,
}: {
  testId: string;
  title: string;
  items: OverviewStackItem[];
  destinations: Array<{ href: string; label: string }>;
  viewAllLabel: string;
  class?: string;
  /** The only remaining list keeps the full desktop width in two item columns. */
  wide?: boolean;
} = $props();
</script>

<OverviewSection class={className} {testId} {title}>
  <Item.Group
    class={cn(
      "min-w-0 gap-0",
      wide && "lg:grid lg:grid-cols-2 lg:gap-x-10",
    )}
  >
    {#each items.slice(0, WORKSPACE_OVERVIEW_PREVIEW_LIMIT) as item, index (item.key)}
      <Item.Root
        class={cn(
          "min-w-0",
          index > 0 && "border-t-border/60",
          wide && index === 1 && "lg:border-t-transparent",
        )}
        size="sm"
      >
        {#snippet child({ props })}
          <a href={item.href} data-overview-item={item.key} {...props}>
            <Item.Content class="min-w-0 gap-0.5">
              <Item.Title class="break-words">{item.title}</Item.Title>
              <Item.Description class="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span>{item.label}</span>
                {#if item.meta}<span class="tabular-nums">{item.meta}</span>{/if}
                <span class="text-xs">{item.weekdayLabel} · {item.dateLabel}</span>
                {#if item.badge}<Badge variant="destructive">{item.badge}</Badge>{/if}
              </Item.Description>
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
