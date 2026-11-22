<script lang="ts" module>
export type ActiveFilter = {
  href: string;
  label: string;
  removeLabel?: string;
};

type LocalFilter = {
  key: string;
  label: string;
  removeLabel: string;
  remove: () => void;
};
</script>

<script lang="ts">
import XIcon from "@lucide/svelte/icons/x";
import { Button } from "#lib/components/ui/button/index.js";

let {
  items, ariaLabel, clearHref, clearLabel, showLabel = false,
  disabled = false, onremove,
}: {
  items: (ActiveFilter | LocalFilter)[];
  ariaLabel: string;
  clearHref?: string;
  clearLabel: string;
  showLabel?: boolean;
  disabled?: boolean;
  onremove?: (event: MouseEvent, href: string) => void;
} = $props();
</script>

{#if items.length}
  <div class="flex min-w-0 flex-wrap items-center gap-2" role="group" aria-label={ariaLabel} data-slot="active-filters">
    {#if showLabel}<span class="text-sm text-muted-foreground">{ariaLabel}</span>{/if}
    {#each items as item ("href" in item ? item.href : item.key)}
      <Button
        href={"href" in item ? item.href : undefined}
        type="button"
        {disabled}
        onclick={(event) => "href" in item ? onremove?.(event, item.href) : item.remove()}
        variant="secondary"
        size="sm"
        class="h-auto min-h-11 min-w-0 max-w-full py-1.5 md:min-h-8"
        aria-label={item.removeLabel ?? `${clearLabel}: ${item.label}`}
      >
        <span class="min-w-0 whitespace-normal text-left [overflow-wrap:anywhere]">{item.label}</span>
        <XIcon data-icon="inline-end" aria-hidden="true" />
      </Button>
    {/each}
    {#if clearHref}<Button href={clearHref} {disabled} variant="ghost" class="min-h-11 md:min-h-8">{clearLabel}</Button>{/if}
  </div>
{/if}
