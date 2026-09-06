<script lang="ts">
import { catalogLinkVisitHref } from "@/features/catalog-links/lib/catalog-links";
import type { WorkspaceOverviewLinkItem } from "@/features/workspace/lib/workspace-controller-helpers";
import { cn } from "$lib/utils.js";

export let link: WorkspaceOverviewLinkItem;

let className = "";

export { className as class };
</script>

<a
  class={cn(
    "flex h-full min-h-12 min-w-0 w-full items-center overflow-hidden px-3 text-left text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset",
    className,
  )}
  href={catalogLinkVisitHref(link.slug)}
  rel="noopener noreferrer"
  target="_blank"
>
  <slot />
</a>
