<script lang="ts">
import { onMount } from "svelte";
import CatalogPageHeader from "@/features/catalog/components/CatalogPageHeader.svelte";
import AnonymousLinksTab from "@/features/dashboard/components/AnonymousLinksTab.svelte";
import LinksTab from "@/features/dashboard/components/LinksTab.svelte";
import { linkIconLabel } from "@/features/dashboard/lib/dashboard-link-icon";
import {
  applyDashboardLinkPinnedSlugs,
  currentDashboardLinkReturnTo,
  submitDashboardLinkPinRequest,
} from "@/features/dashboard/lib/dashboard-link-pin-client";
import { groupDashboardLinks } from "@/features/dashboard-links/lib/dashboard-link-search";
import { mountPageSearchShortcut } from "@/lib/browser/page-search-shortcut";
import type { PageData } from "./$types";

export let data: PageData;

let linkSearchInput: HTMLInputElement | null = null;
let linkSearchQuery = "";
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
  linkReturnTo = currentDashboardLinkReturnTo();
  return mountPageSearchShortcut(() => linkSearchInput);
});
</script>

<svelte:head>
  <title>{data.copy.dashboard.nav.links.title} - Life@USTC</title>
</svelte:head>

<section class="grid gap-5">
  <CatalogPageHeader
    description={data.copy.dashboard.nav.links.description}
    title={data.copy.dashboard.nav.links.title}
  />

  {#if data.signedIn}
    <LinksTab
      {dashboardCopy}
      {linkActionError}
      {linkIconLabel}
      {linkReturnTo}
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
      anonymousLinkGroups={linkGroups}
      bind:linkSearchQuery
      bind:linkSearchInput
    />
  {/if}
</section>
