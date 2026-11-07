<script lang="ts" module>
export type PageSectionNavItem = {
  href: string;
  label: string;
  current?: boolean;
  meta?: string | number;
};
</script>
<script lang="ts">
import { Badge } from "#lib/components/ui/badge/index.js";
import { Button } from "#lib/components/ui/button/index.js";
let { ariaLabel, items, onActivate }: { ariaLabel: string; items: PageSectionNavItem[]; onActivate?: (href: string, event: MouseEvent) => void } = $props();
</script>
<nav aria-label={ariaLabel} class="flex min-w-0 flex-wrap gap-2" data-slot="page-section-nav">
  {#each items as item (item.href)}
    <Button href={item.href} variant={item.current ? "secondary" : "ghost"} class="min-h-11 sm:min-h-9 md:min-h-9" aria-current={item.current ? "page" : undefined} onclick={(event) => onActivate?.(item.href, event)}>
      {item.label}{#if item.meta != null}<Badge variant="secondary">{item.meta}</Badge>{/if}
    </Button>
  {/each}
</nav>
