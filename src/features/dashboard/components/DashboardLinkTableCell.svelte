<script lang="ts">
import type { DashboardOverviewLinkItem } from "@/features/dashboard/lib/dashboard-controller-helpers";
import { cn } from "$lib/utils.js";

export let link: DashboardOverviewLinkItem;

let className = "";

export { className as class };
</script>

<form
  action="/api/catalog/links/resolve"
  class="h-full min-w-0"
  method="POST"
  rel="noopener"
  target="_blank"
>
  <input name="slug" type="hidden" value={link.slug} />
  <button
    class={cn(
      "flex h-full min-h-12 min-w-0 w-full items-center overflow-hidden px-3 text-left text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset",
      className,
    )}
    type="submit"
  >
    <slot />
  </button>
</form>
