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
import * as Alert from "$lib/components/ui/alert";
import { Button } from "$lib/components/ui/button";
import { Skeleton } from "$lib/components/ui/skeleton";
import type { PageData } from "./$types";

export let data: PageData;

let signedIn = false;
let viewerLoading = true;
let viewerFailed = false;
let viewerController: AbortController | null = null;
async function loadLinkPreferences() {
  viewerController?.abort();
  const controller = new AbortController();
  viewerController = controller;
  viewerLoading = true;
  viewerFailed = false;
  try {
    const response = await fetch("/_internal/catalog/links/viewer", {
      cache: "no-store",
      credentials: "same-origin",
      signal: controller.signal,
    });
    if (!response.ok) throw new Error("Failed to load link preferences");
    const result = (await response.json()) as {
      signedIn: boolean;
      links: typeof data.links | null;
    };
    if (controller.signal.aborted) return;
    signedIn = result.signedIn;
    linkItems = result.links ?? data.links;
  } catch {
    if (!controller.signal.aborted) viewerFailed = true;
  } finally {
    if (!controller.signal.aborted) viewerLoading = false;
  }
}
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
  void loadLinkPreferences();
  return () => viewerController?.abort();
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

  {#if viewerLoading}
    <Skeleton class="h-9 w-32" />
  {:else if viewerFailed}
    <Alert.Root variant="destructive">
      <Alert.Description>{workspaceCopy.linkHub.loadFailed}</Alert.Description>
      <Button variant="outline" onclick={() => void loadLinkPreferences()}>{workspaceCopy.linkHub.retry}</Button>
    </Alert.Root>
  {/if}
  {#if signedIn && !viewerLoading && !viewerFailed}
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
