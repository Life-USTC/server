<script lang="ts" module>
export type ActiveFilter = {
  href: string;
  label: string;
  removeLabel?: string;
};
</script>
<script lang="ts">
import XIcon from "@lucide/svelte/icons/x";
import { Button } from "$lib/components/ui/button";
let { items, ariaLabel, clearHref, clearLabel }: { items: ActiveFilter[]; ariaLabel: string; clearHref: string; clearLabel: string } = $props();
</script>
{#if items.length}
  <div class="flex min-w-0 flex-wrap items-center gap-2" role="group" aria-label={ariaLabel} data-slot="active-filters">
    {#each items as item (item.href)}
      <Button href={item.href} variant="secondary" size="sm" class="min-h-11 h-auto max-w-full min-w-0 py-1.5 sm:min-h-8" aria-label={item.removeLabel ?? `${clearLabel}: ${item.label}`}>
        <span class="min-w-0 whitespace-normal text-left [overflow-wrap:anywhere]">{item.label}</span><XIcon data-icon="inline-end" aria-hidden="true" />
      </Button>
    {/each}
    <Button href={clearHref} variant="ghost" size="sm" class="min-h-11 sm:min-h-8">{clearLabel}</Button>
  </div>
{/if}
