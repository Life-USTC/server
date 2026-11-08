<script lang="ts">
import { onMount, tick } from "svelte";
import { get } from "svelte/store";
import CollectionPage from "#lib/components/CollectionPage.svelte";
import * as Alert from "#lib/components/ui/alert/index.js";
import { Button } from "#lib/components/ui/button/index.js";
import { Skeleton } from "#lib/components/ui/skeleton/index.js";
import { groupCatalogLinks } from "@/features/catalog-links/lib/catalog-link-search";
import DemoNotice from "@/features/demo/components/DemoNotice.svelte";
import { homePublicReadEpoch } from "@/features/demo/lib/demo-home-owner";
import AnonymousLinksTab from "@/features/workspace/components/AnonymousLinksTab.svelte";
import LinksTab from "@/features/workspace/components/LinksTab.svelte";
import { workspaceCalendarOwner } from "@/features/workspace/lib/workspace-calendar-owner";
import { linkIconLabel } from "@/features/workspace/lib/workspace-link-icon";
import {
  applyCatalogLinkPinnedSlugs,
  currentCatalogLinkReturnTo,
  submitWorkspaceLinkPinRequest,
} from "@/features/workspace/lib/workspace-link-pin-client";
import { CATALOG_LINKS_VIEWER_PATH } from "@/lib/navigation/internal-routes";
import { getShellViewer } from "@/lib/shell/shell-viewer";
import { browser } from "$app/env";
import { afterNavigate } from "$app/navigation";
import type { PageData } from "./$types";

export let data: PageData;

const shellViewer = getShellViewer();
let mounted = false;
let viewerGeneration = 0;
let revealRequest = 0;
let revealGeneration = 0;
$: readable = !browser || Boolean(homePublicReadEpoch($shellViewer, data.demo));
$: viewerIdentity = `${$shellViewer.status}:${workspaceCalendarOwner($shellViewer, data.demo).epoch}:${data.demo?.expiresAt ?? "ordinary"}:${data.locale}:${readable}`;
$: if (mounted) resetViewer(viewerIdentity);
$: if (mounted && readable)
  void revealDemoLink(window.location.hash, viewerIdentity);

async function revealDemoLink(hash: string, _owner: string) {
  const generation = ++revealGeneration;
  const epoch = currentDemoLinkEpoch();
  if (!epoch || !hash.startsWith("#link-")) return;
  let slug: string;
  try {
    slug = decodeURIComponent(hash.slice("#link-".length));
  } catch {
    return;
  }
  if (!data.links.some((link) => link.slug === slug)) return;
  const owner = viewerGeneration;
  revealRequest += 1;
  await tick();
  if (
    !mounted ||
    currentDemoLinkEpoch() !== epoch ||
    owner !== viewerGeneration ||
    generation !== revealGeneration ||
    window.location.hash !== hash
  )
    return;
  // Both responsive copies exist in the DOM. Focus only the currently visible row/card.
  const target = [
    ...document.querySelectorAll<HTMLElement>("[data-catalog-link-slug]"),
  ].find(
    (element) =>
      element.dataset.catalogLinkSlug === slug &&
      element.getClientRects().length > 0,
  );
  target?.scrollIntoView({ block: "center" });
  target?.focus({ preventScroll: true });
}
function currentDemoLinkEpoch() {
  const demo = data.demo;
  if (!demo || demo.expiresAt <= Date.now()) return "";
  return homePublicReadEpoch(get(shellViewer), demo);
}
function resetViewer(_identity: string) {
  viewerGeneration += 1;
  viewerController?.abort();
  signedIn = false;
  linkItems = readable ? data.links : [];
  linkActionError = "";
  updatingCatalogLinkSlug = null;
  viewerLoading = !data.demo && $shellViewer.status === "loading";
  viewerFailed = !data.demo && $shellViewer.status === "error";
  if (
    readable &&
    !data.demo &&
    $shellViewer.status === "ready" &&
    $shellViewer.viewer
  )
    void loadLinkPreferences();
}
async function retryViewer() {
  if (!readable || data.demo) return;
  if ($shellViewer.status === "error") await shellViewer.retry();
  else void loadLinkPreferences();
}
let signedIn = false;
let viewerLoading = !data.demo;
let viewerFailed = false;
let viewerController: AbortController | null = null;
async function loadLinkPreferences() {
  if (!readable || data.demo || !$shellViewer.viewer) return;
  viewerController?.abort();
  const controller = new AbortController();
  viewerController = controller;
  viewerLoading = true;
  viewerFailed = false;
  try {
    const response = await fetch(CATALOG_LINKS_VIEWER_PATH, {
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
  if (
    data.demo ||
    !readable ||
    updatingCatalogLinkSlug ||
    !signedIn ||
    viewerLoading ||
    viewerFailed
  )
    return;
  const generation = viewerGeneration;
  updatingCatalogLinkSlug = slug;
  linkActionError = "";
  try {
    const pinnedSlugs = await submitWorkspaceLinkPinRequest({
      action,
      fallbackMessage: workspaceCopy.linkHub.pinFailedDescription,
      returnTo: linkReturnTo,
      slug,
    });
    if (generation !== viewerGeneration) return;
    linkItems = applyCatalogLinkPinnedSlugs(linkItems, pinnedSlugs);
  } catch (error) {
    if (generation !== viewerGeneration) return;
    linkActionError = error instanceof Error ? error.message : "";
  } finally {
    if (generation === viewerGeneration) updatingCatalogLinkSlug = null;
  }
}

onMount(() => {
  linkReturnTo = currentCatalogLinkReturnTo();
  mounted = true;
  return () => {
    mounted = false;
    revealGeneration += 1;
    viewerGeneration += 1;
    viewerController?.abort();
  };
});
afterNavigate(({ to }) => {
  if (mounted && to) void revealDemoLink(to.url.hash, viewerIdentity);
});
</script>

<svelte:head>
  <title>{data.copy.workspace.nav.links.title} - Life@USTC</title>
</svelte:head>

<CollectionPage description={data.copy.workspace.nav.links.description} panel={false} title={data.copy.workspace.nav.links.title}>

  {#if data.demo}<DemoNotice demo={data.demo} locale={data.locale} /><p class="mb-4 text-sm" data-testid="demo-links-fictional">{data.linksSampleNotice}</p>{/if}
  {#if !readable}
    <Skeleton class="h-20 w-full" />
  {:else}
  {#if viewerLoading}
    <Skeleton class="h-9 w-32" />
  {:else if viewerFailed}
    <Alert.Root variant="destructive">
      <Alert.Description>{workspaceCopy.linkHub.loadFailed}</Alert.Description>
      <Button variant="outline" onclick={() => void retryViewer()}>{workspaceCopy.linkHub.retry}</Button>
    </Alert.Root>
  {/if}
  {#if data.demo || (signedIn && !viewerLoading && !viewerFailed)}
    <LinksTab
      {revealRequest}
      readOnlyReason={data.demo?.readOnlyReason}
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
  {/if}
</CollectionPage>
