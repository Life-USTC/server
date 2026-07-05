<script lang="ts">
import type { DashboardBusCopy } from "@/features/dashboard/lib/bus-tab-types";
import type {
  AnonymousDashboardData,
  AnonymousLinkGroup,
  DashboardDashboardCopy,
  DashboardHomepageCopy,
  LinkView,
} from "@/features/dashboard/lib/dashboard-controller-helpers";
import AnonymousLinksTab from "./AnonymousLinksTab.svelte";
import BusTab from "./BusTab.svelte";

export let anonymousData: AnonymousDashboardData;
export let anonymousLinkGroups: AnonymousLinkGroup[];
export let busCopy: DashboardBusCopy;
export let dashboardCopy: DashboardDashboardCopy;
export let homepageCopy: DashboardHomepageCopy;
export let linkIconLabel: (icon: string) => string;
export let linkSearchInput: HTMLInputElement | null;
export let linkSearchQuery: string;
export let linkView: LinkView;
export let setLinkView: (view: LinkView) => void;

$: currentTool =
  anonymousData.tab === "links"
    ? dashboardCopy.nav.links
    : dashboardCopy.nav.bus;
</script>

<div class="mx-auto grid w-full max-w-7xl gap-5">
  <div class="grid gap-1">
    <p class="font-medium text-muted-foreground text-sm">
      {homepageCopy.publicDashboard.title}
    </p>
    <div class="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
      <div class="grid gap-1">
        <h1 class="font-semibold text-2xl tracking-normal sm:text-3xl">
          {currentTool.title}
        </h1>
        <p class="max-w-3xl text-muted-foreground text-sm">
          {currentTool.description}
        </p>
      </div>
    </div>
  </div>

  {#if anonymousData.tab === "links"}
    <AnonymousLinksTab
      {dashboardCopy}
      {linkIconLabel}
      {setLinkView}
      {linkView}
      {anonymousLinkGroups}
      bind:linkSearchQuery
      bind:linkSearchInput
    />
  {:else}
    <BusTab
      {busCopy}
      bus={anonymousData.bus ?? null}
    />
  {/if}
</div>
