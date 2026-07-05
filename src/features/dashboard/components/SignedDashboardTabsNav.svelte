<script lang="ts">
import type {
  DashboardDashboardCopy,
  SignedDashboardData,
} from "@/features/dashboard/lib/dashboard-controller-helpers";
import type { SignedTabId } from "@/features/dashboard/lib/dashboard-nav";
import { Badge } from "$lib/components/ui/badge/index.js";
import { Button } from "$lib/components/ui/button/index.js";

export let dashboardCopy: DashboardDashboardCopy;
export let dashboardTabHref: (id: SignedTabId) => string;
export let signedData: SignedDashboardData;
export let signedTabBadge: (
  data: SignedDashboardData,
  id: SignedTabId,
) => number | null;
export let signedTabs: ReadonlyArray<readonly [SignedTabId, string]>;

$: selectedTab = signedData.tab ?? "overview";
</script>

<nav
  aria-label={dashboardCopy.nav.ariaLabel}
  class="flex w-full flex-wrap items-center gap-1"
>
  {#each signedTabs as [id, label]}
    {@const badge = signedTabBadge(signedData, id)}
    <Button
      aria-current={id === selectedTab ? "page" : undefined}
      class={id === "bus" ? "md:ml-auto" : ""}
      href={dashboardTabHref(id)}
      size="sm"
      variant={id === selectedTab ? "secondary" : "ghost"}
    >
      {label}
      {#if badge !== null && badge > 0}
        <Badge variant="ghost">{badge}</Badge>
      {/if}
    </Button>
  {/each}
</nav>
