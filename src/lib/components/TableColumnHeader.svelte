<script lang="ts">
import ArrowDownIcon from "@lucide/svelte/icons/arrow-down";
import ArrowUpIcon from "@lucide/svelte/icons/arrow-up";
import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";
import FilterIcon from "@lucide/svelte/icons/filter";
import type { Snippet } from "svelte";
import { Button } from "#lib/components/ui/button/index.js";
import * as Popover from "#lib/components/ui/popover/index.js";
import { afterNavigate } from "$app/navigation";

let {
  label,
  active = false,
  disabled = false,
  sort = null,
  open = $bindable(false),
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  sort?: "asc" | "desc" | null;
  open?: boolean;
  children: Snippet;
} = $props();

afterNavigate(({ shallow, type }) => {
  if (shallow && type === "goto") return;
  open = false;
});
</script>

{#snippet indicator()}
  {#if sort === "asc"}
    <ArrowUpIcon data-icon="inline-end" aria-hidden="true" />
  {:else if sort === "desc"}
    <ArrowDownIcon data-icon="inline-end" aria-hidden="true" />
  {:else if active}
    <FilterIcon data-icon="inline-end" aria-hidden="true" />
  {:else}
    <ChevronDownIcon data-icon="inline-end" aria-hidden="true" />
  {/if}
{/snippet}

<div class="flex min-w-0" data-slot="table-column-header">
  <Popover.Root bind:open>
    <Popover.Trigger>
      {#snippet child({ props })}
        <Button {...props} {disabled} variant="ghost" class="-mx-[11px]" data-active={active || sort ? "true" : undefined}>
          <span>{label}</span>
          {@render indicator()}
        </Button>
      {/snippet}
    </Popover.Trigger>
    <Popover.Content align="start" role="dialog" aria-label={label} class="w-80 max-w-[calc(100vw-2rem)] overflow-y-auto" style="max-height: min(70dvh, var(--bits-popover-content-available-height))">
      {@render children()}
    </Popover.Content>
  </Popover.Root>
</div>
