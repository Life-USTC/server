<script lang="ts">
import SlidersHorizontalIcon from "@lucide/svelte/icons/sliders-horizontal";
import { onMount, type Snippet } from "svelte";
import { toolbarControlClass } from "#lib/components/toolbar-control.js";
import { Badge } from "#lib/components/ui/badge/index.js";
import { Button } from "#lib/components/ui/button/index.js";
import * as Sheet from "#lib/components/ui/sheet/index.js";
import { afterNavigate } from "$app/navigation";

let {
  primary,
  advanced,
  actions,
  filterTitle = "",
  activeCount = 0,
  open = $bindable(false),
}: {
  primary: Snippet;
  advanced?: Snippet;
  actions?: Snippet;
  filterTitle?: string;
  activeCount?: number;
  open?: boolean;
} = $props();

let narrow = $state(false);

afterNavigate(({ shallow, type }) => {
  if (shallow && type === "goto") return;

  open = false;
});

onMount(() => {
  const query = window.matchMedia("(max-width: 767px)");
  const update = () => {
    narrow = query.matches;
  };
  update();
  query.addEventListener("change", update);
  return () => query.removeEventListener("change", update);
});
</script>

<div class="flex min-w-0 flex-wrap items-end gap-2" data-slot="filter-toolbar">
  {@render primary()}
  {#if advanced}
    <Sheet.Root bind:open>
      <Sheet.Trigger>
        {#snippet child({ props })}
          <Button {...props} type="button" variant="outline" class="{toolbarControlClass} order-2 md:order-4">
            <SlidersHorizontalIcon data-icon="inline-start" aria-hidden="true" />
            <span class="max-md:sr-only">{filterTitle}</span>
            {#if activeCount}<Badge variant="secondary">{activeCount}</Badge>{/if}
          </Button>
        {/snippet}
      </Sheet.Trigger>
      <Sheet.Content side={narrow ? "bottom" : "right"} class={narrow ? "max-h-[85dvh] gap-0 overflow-hidden rounded-t-xl p-0" : "gap-0 overflow-hidden p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-lg"}>
        <Sheet.Header class="shrink-0 border-b pr-12">
          <Sheet.Title>{filterTitle}</Sheet.Title>
          <Sheet.Description class="sr-only">{filterTitle}</Sheet.Description>
        </Sheet.Header>
        <div class="min-h-0 flex-1 overflow-y-auto p-4">{@render advanced()}</div>
      </Sheet.Content>
    </Sheet.Root>
  {/if}
  {#if actions}<div class="flex flex-wrap items-center gap-2">{@render actions()}</div>{/if}
</div>
