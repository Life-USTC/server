<script lang="ts">
import type { DashboardOverviewLinkItem } from "@/features/dashboard/lib/dashboard-controller-helpers";
import { dashboardLinkVisitHref } from "@/features/dashboard-links/lib/dashboard-links";
import { cn } from "$lib/utils.js";

export let link: DashboardOverviewLinkItem;

let className = "";

export { className as class };
</script>

<a
  class={cn(
    "flex h-full min-h-12 min-w-0 w-full items-center overflow-hidden px-3 text-left text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset",
    className,
  )}
  href={dashboardLinkVisitHref(link.slug)}
  rel="noopener noreferrer"
  target="_blank"
>
  <slot />
</a>
