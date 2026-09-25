<script lang="ts" module>
export type PageSectionNavItem = {
  href: string;
  label: string;
  current?: boolean;
  meta?: string | number;
};
</script>
<script lang="ts">
import { Badge } from "$lib/components/ui/badge";
import { Button } from "$lib/components/ui/button";
let { ariaLabel, items }: { ariaLabel: string; items: PageSectionNavItem[] } = $props();
</script>
<nav aria-label={ariaLabel} class="flex min-w-0 flex-wrap gap-2" data-slot="page-section-nav">
  {#each items as item (item.href)}
    <Button href={item.href} variant={item.current ? "secondary" : "ghost"} class="min-h-11 sm:min-h-9" aria-current={item.current ? "page" : undefined}>
      {item.label}{#if item.meta != null}<Badge variant="secondary">{item.meta}</Badge>{/if}
    </Button>
  {/each}
</nav>
