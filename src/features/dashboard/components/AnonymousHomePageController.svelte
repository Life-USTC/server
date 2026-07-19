<script lang="ts">
import { onMount } from "svelte";
import type {
  DashboardBusCopy,
  DashboardBusData,
} from "@/features/dashboard/lib/bus-tab-types";
import type {
  DashboardDashboardCopy,
  DashboardHomepageCopy,
  LinkView,
} from "@/features/dashboard/lib/dashboard-controller-helpers";
import { dashboardLinkViewChange } from "@/features/dashboard/lib/dashboard-controller-view-actions";
import { linkIconLabel } from "@/features/dashboard/lib/dashboard-link-icon";
import {
  DASHBOARD_VIEW_STORAGE_KEY,
  dashboardViewsFromPreference,
} from "@/features/dashboard/lib/view-preferences";
import { groupDashboardLinks } from "@/features/dashboard-links/lib/dashboard-link-search";
import type { DashboardLinkSummary } from "@/features/dashboard-links/server/dashboard-link-data";
import { getLocalStorageItem } from "@/lib/browser/local-storage";
import { replaceState } from "$app/navigation";
import AnonymousDashboardView from "./AnonymousDashboardView.svelte";

type AnonymousHomePageData = {
  bus?: DashboardBusData | null;
  copy: {
    bus: DashboardBusCopy;
    dashboard: Pick<DashboardDashboardCopy, "linkHub"> & {
      nav: Pick<DashboardDashboardCopy["nav"], "bus" | "links">;
    };
    homepage: DashboardHomepageCopy;
    metadata: { home: string };
  };
  publicLinks: DashboardLinkSummary[];
  signedIn: false;
  tab: string;
};

export let data: AnonymousHomePageData;

let linkSearchInput: HTMLInputElement | null = null;
let linkSearchQuery = "";
let linkView: LinkView = "grid";

$: dashboardCopy = data.copy.dashboard;
$: anonymousLinkGroups = groupDashboardLinks(
  data.publicLinks,
  linkSearchQuery,
  dashboardCopy.linkHub.groups,
);

function setLinkView(mode: LinkView) {
  const next = dashboardLinkViewChange(mode);
  linkView = next.state.linkView;
  replaceState(next.href, {});
}

onMount(() => {
  const url = new URL(window.location.href);
  linkView = dashboardViewsFromPreference(
    url,
    getLocalStorageItem(DASHBOARD_VIEW_STORAGE_KEY),
  ).linkView;

  function handleShortcut(event: KeyboardEvent) {
    if (
      (event.metaKey || event.ctrlKey) &&
      event.key.toLowerCase() === "k" &&
      linkSearchInput
    ) {
      event.preventDefault();
      linkSearchInput.focus();
    }
  }

  window.addEventListener("keydown", handleShortcut);
  return () => window.removeEventListener("keydown", handleShortcut);
});
</script>

<svelte:head>
  <title>{data.copy.metadata.home} - Life@USTC</title>
</svelte:head>

<AnonymousDashboardView
  busCopy={data.copy.bus}
  {dashboardCopy}
  homepageCopy={data.copy.homepage}
  anonymousData={data}
  {anonymousLinkGroups}
  {linkIconLabel}
  {linkView}
  {setLinkView}
  bind:linkSearchInput
  bind:linkSearchQuery
/>
