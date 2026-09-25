<script lang="ts">
import { onMount } from "svelte";
import { groupCatalogLinks } from "@/features/catalog-links/lib/catalog-link-search";
import AnonymousLinksTab from "@/features/workspace/components/AnonymousLinksTab.svelte";
import LinksTab from "@/features/workspace/components/LinksTab.svelte";
import { linkIconLabel } from "@/features/workspace/lib/workspace-link-icon";
import {
  applyCatalogLinkPinnedSlugs,
  currentCatalogLinkReturnTo,
  submitWorkspaceLinkPinRequest,
} from "@/features/workspace/lib/workspace-link-pin-client";
import PageHeader from "$lib/components/PageHeader.svelte";
import PageLayout from "$lib/components/PageLayout.svelte";
import type { PageData } from "./$types";

export let data: PageData;

let linkSearchQuery = "";
let linkActionError = "";
let linkItems = data.links;
let linkReturnTo = "/catalog/links";
let updatingCatalogLinkSlug: string | null = null;

$: workspaceCopy = data.copy.workspace;
$: linkGroups = groupCatalogLinks(
  linkItems,
  linkSearchQuery,
  workspaceCopy.linkHub.groups,
);

async function submitWorkspaceLinkPin(slug: string, action: "pin" | "unpin") {
  if (updatingCatalogLinkSlug) return;
  updatingCatalogLinkSlug = slug;
  linkActionError = "";
  try {
    const pinnedSlugs = await submitWorkspaceLinkPinRequest({
      action,
      fallbackMessage: workspaceCopy.linkHub.pinFailedDescription,
      returnTo: linkReturnTo,
      slug,
    });
    linkItems = applyCatalogLinkPinnedSlugs(linkItems, pinnedSlugs);
  } catch (error) {
    linkActionError = error instanceof Error ? error.message : "";
  } finally {
    updatingCatalogLinkSlug = null;
  }
}

onMount(() => {
  linkReturnTo = currentCatalogLinkReturnTo();
});
</script>

<svelte:head>
  <title>{data.copy.workspace.nav.links.title} - Life@USTC</title>
</svelte:head>

<PageLayout>
  {#snippet header()}
    <PageHeader
      description={data.copy.workspace.nav.links.description}
      title={data.copy.workspace.nav.links.title}
    />
  {/snippet}

  {#if data.signedIn}
    <LinksTab
      {workspaceCopy}
      {linkActionError}
      {linkIconLabel}
      {linkReturnTo}
      signedLinkGroups={linkGroups}
      submitWorkspaceLinkPin={submitWorkspaceLinkPin}
      {updatingCatalogLinkSlug}
      bind:linkSearchQuery
    />
  {:else}
    <AnonymousLinksTab
      {workspaceCopy}
      {linkIconLabel}
      anonymousLinkGroups={linkGroups}
      bind:linkSearchQuery
    />
  {/if}
</PageLayout>
