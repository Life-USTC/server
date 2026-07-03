<script lang="ts">
import type { Component } from "svelte";
import { Badge } from "$lib/components/ui/badge/index.js";
import * as Sidebar from "$lib/components/ui/sidebar/index.js";

export let activeCount = 0;
export let description = "";
export let icon: Component | undefined = undefined;
export let title: string;
</script>

<Sidebar.Provider
  style="--sidebar-width: 17rem;"
  class="min-h-0 w-full lg:w-auto"
>
  <Sidebar.Root
    collapsible="none"
    class="w-full border-sidebar-border border-b bg-sidebar lg:sticky lg:top-12 lg:h-[calc(100vh-10.75rem)] lg:w-(--sidebar-width) lg:border-e lg:border-b-0"
    data-testid="catalog-filter-sidebar"
  >
    <Sidebar.Header class="border-sidebar-border border-b p-3">
      <div class="flex min-w-0 items-start justify-between gap-3">
        <div class="flex min-w-0 gap-2">
          {#if icon}
            <span
              class="mt-0.5 flex shrink-0 items-center justify-center text-sidebar-foreground/60 [&_svg]:size-4"
              aria-hidden="true"
            >
              <svelte:component this={icon} />
            </span>
          {/if}
          <div class="min-w-0">
            <p class="font-medium text-sidebar-foreground text-sm">{title}</p>
            {#if description}
              <p class="mt-0.5 text-sidebar-foreground/60 text-xs">{description}</p>
            {/if}
          </div>
        </div>
        {#if activeCount > 0}
          <Badge class="shrink-0" variant="secondary">{activeCount}</Badge>
        {/if}
      </div>
    </Sidebar.Header>

    <Sidebar.Content class="p-3">
      <div>
        <slot />
      </div>
    </Sidebar.Content>
  </Sidebar.Root>
</Sidebar.Provider>
