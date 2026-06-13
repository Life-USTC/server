<script lang="ts">
import { onMount } from "svelte";
import type { DashboardBusCopy } from "@/features/dashboard/lib/bus-tab-types";
import type {
  AnonymousDashboardData,
  AnonymousLinkGroup,
  DashboardDashboardCopy,
  LinkView,
} from "@/features/dashboard/lib/dashboard-controller-helpers";
import { Alert } from "$lib/components/ui/alert/index.js";
import * as Tabs from "$lib/components/ui/tabs/index.js";
import AnonymousLinksTab from "./AnonymousLinksTab.svelte";
import BusTab from "./BusTab.svelte";

export let anonymousData: AnonymousDashboardData;
export let anonymousLinkGroups: AnonymousLinkGroup[];
export let busCopy: DashboardBusCopy;
export let dashboardCopy: DashboardDashboardCopy;
export let linkIconLabel: (icon: string) => string;
export let linkSearchInput: HTMLInputElement | null;
export let linkSearchQuery: string;
export let linkView: LinkView;
export let setLinkView: (view: LinkView) => void;

let mounted = false;

onMount(() => {
  mounted = true;
});
</script>

<div class="flex flex-wrap justify-end gap-1">
  <Tabs.Root class="gap-0">
    <Tabs.List aria-label={dashboardCopy.nav.ariaLabel} class="!w-full !flex-wrap !justify-end !overflow-visible">
      <Tabs.Link href="/?tab=bus" selected={anonymousData.tab === "bus"}>
        {dashboardCopy.nav.bus.title}
      </Tabs.Link>
      <Tabs.Link href="/?tab=links" selected={anonymousData.tab === "links"}>
        {dashboardCopy.nav.links.title}
      </Tabs.Link>
    </Tabs.List>
  </Tabs.Root>
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
{:else if mounted}
  <BusTab
    {busCopy}
    bus={anonymousData.bus ?? null}
  />
{:else}
  <Alert>{busCopy.empty}</Alert>
{/if}
