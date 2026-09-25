<script lang="ts">
import SlidersHorizontalIcon from "@lucide/svelte/icons/sliders-horizontal";
import type { Snippet } from "svelte";
import { afterNavigate } from "$app/navigation";
import { Badge } from "$lib/components/ui/badge";
import { Button } from "$lib/components/ui/button";
import * as Sheet from "$lib/components/ui/sheet";

let {
  primary,
  advanced,
  actions,
  filterTitle = "",
  filterDescription,
  activeCount = 0,
  open = $bindable(false),
}: {
  primary: Snippet;
  advanced?: Snippet;
  actions?: Snippet;
  filterTitle?: string;
  filterDescription?: string;
  activeCount?: number;
  open?: boolean;
} = $props();

afterNavigate(() => {
  open = false;
});
</script>

<div class="grid min-w-0 gap-3" data-slot="filter-toolbar">
  <div class="flex min-w-0 flex-wrap items-end gap-2">
    <div class="min-w-0 basis-full sm:basis-64 sm:flex-1">{@render primary()}</div>
    {#if advanced}
      <Sheet.Root bind:open>
        <Sheet.Trigger>
          {#snippet child({ props })}
            <Button {...props} type="button" variant="outline" class="h-11" aria-label={activeCount ? `${filterTitle} (${activeCount})` : filterTitle}>
              <SlidersHorizontalIcon data-icon="inline-start" aria-hidden="true" />
              {filterTitle}
              {#if activeCount}<Badge variant="secondary">{activeCount}</Badge>{/if}
            </Button>
          {/snippet}
        </Sheet.Trigger>
        <Sheet.Content side="right" class="overflow-hidden p-0 data-[side=right]:w-[calc(100%-1rem)] data-[side=right]:max-w-lg">
          <Sheet.Header class="shrink-0 border-b pr-12">
            <Sheet.Title>{filterTitle}</Sheet.Title>
            <Sheet.Description class={filterDescription ? undefined : "sr-only"}>{filterDescription || filterTitle}</Sheet.Description>
          </Sheet.Header>
          <div class="min-h-0 flex-1 overflow-y-auto p-4">{@render advanced()}</div>
        </Sheet.Content>
      </Sheet.Root>
    {/if}
    {#if actions}<div class="flex flex-wrap items-center gap-2">{@render actions()}</div>{/if}
  </div>
</div>
