<script lang="ts">
import type {
  DashboardDashboardCopy,
  SignedDashboardData,
} from "@/features/dashboard/lib/dashboard-controller-helpers";
import type { SignedTabId } from "@/features/dashboard/lib/dashboard-nav";
import { Badge } from "$lib/components/ui/badge/index.js";
import * as Tabs from "$lib/components/ui/tabs/index.js";

export let dashboardCopy: DashboardDashboardCopy;
export let dashboardTabHref: (id: SignedTabId) => string;
export let signedData: SignedDashboardData;
export let signedTabBadge: (
  data: SignedDashboardData,
  id: SignedTabId,
) => number | null;
export let signedTabs: ReadonlyArray<readonly [SignedTabId, string]>;
</script>

<Tabs.Root class="gap-0">
  <Tabs.List aria-label={dashboardCopy.nav.ariaLabel} class="!w-full !flex-wrap !overflow-visible">
    {#each signedTabs as [id, label]}
      {@const badge = signedTabBadge(signedData, id)}
      <Tabs.Link class={id === "bus" ? "md:ml-auto" : ""} href={dashboardTabHref(id)} selected={signedData.tab === id}>
        {label}
        {#if badge !== null && badge > 0}
          <Badge class="ml-2" variant="ghost">{badge}</Badge>
        {/if}
      </Tabs.Link>
    {/each}
  </Tabs.List>
</Tabs.Root>
