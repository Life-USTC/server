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
import { mountPageSearchShortcut } from "@/lib/browser/page-search-shortcut";
import PageHeader from "$lib/components/PageHeader.svelte";
import type { PageData } from "./$types";

export let data: PageData;

let linkSearchInput: HTMLInputElement | null = null;
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
  return mountPageSearchShortcut(() => linkSearchInput);
});
</script>

<svelte:head>
  <title>{data.copy.workspace.nav.links.title} - Life@USTC</title>
</svelte:head>

<section class="grid gap-5">
  <PageHeader
    description={data.copy.workspace.nav.links.description}
    title={data.copy.workspace.nav.links.title}
  />

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
      bind:linkSearchInput
    />
  {:else}
    <AnonymousLinksTab
      {workspaceCopy}
      {linkIconLabel}
      anonymousLinkGroups={linkGroups}
      bind:linkSearchQuery
      bind:linkSearchInput
    />
  {/if}
</section>
