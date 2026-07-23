<script lang="ts">
import { onMount } from "svelte";
import AnonymousLinksTab from "@/features/dashboard/components/AnonymousLinksTab.svelte";
import LinksTab from "@/features/dashboard/components/LinksTab.svelte";
import type { LinkView } from "@/features/dashboard/lib/dashboard-controller-helpers";
import { dashboardLinkViewChange } from "@/features/dashboard/lib/dashboard-controller-view-actions";
import { linkIconLabel } from "@/features/dashboard/lib/dashboard-link-icon";
import {
  applyDashboardLinkPinnedSlugs,
  currentDashboardLinkReturnTo,
  submitDashboardLinkPinRequest,
} from "@/features/dashboard/lib/dashboard-link-pin-client";
import {
  DASHBOARD_VIEW_STORAGE_KEY,
  dashboardViewsFromPreference,
} from "@/features/dashboard/lib/view-preferences";
import { groupDashboardLinks } from "@/features/dashboard-links/lib/dashboard-link-search";
import { getLocalStorageItem } from "@/lib/browser/local-storage";
import { replaceState } from "$app/navigation";
import type { PageData } from "./$types";

export let data: PageData;

let linkSearchInput: HTMLInputElement | null = null;
let linkSearchQuery = "";
let linkView: LinkView = "grid";
let linkActionError = "";
let linkItems = data.links;
let linkReturnTo = "/catalog/links";
let updatingDashboardLinkSlug: string | null = null;

$: dashboardCopy = data.copy.dashboard;
$: linkGroups = groupDashboardLinks(
  linkItems,
  linkSearchQuery,
  dashboardCopy.linkHub.groups,
);

function setLinkView(mode: LinkView) {
  const next = dashboardLinkViewChange(mode);
  linkView = next.state.linkView;
  linkReturnTo = next.href;
  replaceState(next.href, {});
}

async function submitDashboardLinkPin(slug: string, action: "pin" | "unpin") {
  if (updatingDashboardLinkSlug) return;
  updatingDashboardLinkSlug = slug;
  linkActionError = "";
  try {
    const pinnedSlugs = await submitDashboardLinkPinRequest({
      action,
      fallbackMessage: dashboardCopy.linkHub.pinFailedDescription,
      returnTo: linkReturnTo,
      slug,
    });
    linkItems = applyDashboardLinkPinnedSlugs(linkItems, pinnedSlugs);
  } catch (error) {
    linkActionError = error instanceof Error ? error.message : "";
  } finally {
    updatingDashboardLinkSlug = null;
  }
}

onMount(() => {
  const url = new URL(window.location.href);
  linkReturnTo = currentDashboardLinkReturnTo();
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
  <title>{data.copy.dashboard.nav.links.title} - Life@USTC</title>
</svelte:head>

<div class="mx-auto grid w-full max-w-7xl gap-5">
  <div class="grid gap-1">
    <p class="font-medium text-muted-foreground text-sm">
      {data.copy.homepage.publicDashboard.title}
    </p>
    <h1 class="font-semibold text-2xl tracking-normal sm:text-3xl">
      {data.copy.dashboard.nav.links.title}
    </h1>
    <p class="max-w-3xl text-muted-foreground text-sm">
      {data.copy.dashboard.nav.links.description}
    </p>
  </div>

  {#if data.signedIn}
    <LinksTab
      {dashboardCopy}
      {linkActionError}
      {linkIconLabel}
      {linkReturnTo}
      {linkView}
      setLinkView={setLinkView}
      signedLinkGroups={linkGroups}
      submitDashboardLinkPin={submitDashboardLinkPin}
      {updatingDashboardLinkSlug}
      bind:linkSearchQuery
      bind:linkSearchInput
    />
  {:else}
    <AnonymousLinksTab
      {dashboardCopy}
      {linkIconLabel}
      {setLinkView}
      {linkView}
      anonymousLinkGroups={linkGroups}
      bind:linkSearchQuery
      bind:linkSearchInput
    />
  {/if}
</div>
