<script lang="ts">
import { onMount } from "svelte";
import type { BusUserPreferenceSummary } from "@/features/bus/lib/bus-types";
import BusTab from "@/features/workspace/components/BusTab.svelte";
import { getShellViewer } from "@/lib/shell/shell-viewer";
import { invalidateAll } from "$app/navigation";
import PageHeader from "$lib/components/PageHeader.svelte";
import PageLayout from "$lib/components/PageLayout.svelte";
import * as Alert from "$lib/components/ui/alert";
import { Button } from "$lib/components/ui/button";
import { Skeleton } from "$lib/components/ui/skeleton";
import type { PageData } from "./$types";

export let data: PageData;
let preferencesReady = false;
let preferencesFailed = false;
const shellViewer = getShellViewer();
$: viewerId = $shellViewer.viewer?.id ?? null;
$: viewerStatus = $shellViewer.status;
let mounted = false;
let preferencesViewerId: string | null | undefined;
$: if (
  mounted &&
  viewerStatus === "ready" &&
  preferencesViewerId !== viewerId
) {
  preferencesViewerId = viewerId;
  void loadPreferences();
}
$: if (mounted && viewerStatus === "error") {
  preferencesReady = false;
  preferencesFailed = true;
}
let busData = data.bus;
let plannerInteracted = false;
let plannerVersion = 0;
let signedIn = false;
let preferencesController: AbortController | null = null;
async function loadPreferences() {
  preferencesController?.abort();
  const controller = new AbortController();
  preferencesController = controller;
  preferencesReady = false;
  preferencesFailed = false;
  if (!viewerId) {
    busData = data.bus;
    signedIn = false;
    preferencesReady = true;
    return;
  }
  try {
    const response = await fetch("/api/workspace/bus-preferences", {
      cache: "no-store",
      credentials: "same-origin",
      signal: controller.signal,
    });
    if (response.status === 401) {
      signedIn = false;
      preferencesReady = true;
      return;
    }
    if (!response.ok) throw new Error(data.copy.bus.preferencesLoadFailed);
    const result = (await response.json()) as {
      preference: BusUserPreferenceSummary;
    };
    if (controller.signal.aborted) return;
    busData = data.bus ? { ...data.bus, preferences: result.preference } : null;
    signedIn = true;
    if (!plannerInteracted) plannerVersion += 1;
    preferencesReady = true;
  } catch {
    if (!controller.signal.aborted) preferencesFailed = true;
  }
}
async function retryPreferences() {
  if (viewerStatus === "error") await invalidateAll();
  if (viewerStatus === "ready") void loadPreferences();
}
onMount(() => {
  mounted = true;
  return () => preferencesController?.abort();
});
</script>

<svelte:head>
  <title>{data.copy.workspace.nav.bus.title} - Life@USTC</title>
</svelte:head>

<PageLayout>
{#snippet header()}
  <PageHeader
    description={data.copy.workspace.nav.bus.description}
    title={data.copy.workspace.nav.bus.title}
  />
{/snippet}

  {#if preferencesFailed}
    <Alert.Root variant="destructive">
      <Alert.Description>{data.copy.bus.preferencesLoadFailed}</Alert.Description>
      <Button variant="outline" onclick={() => void retryPreferences()}>{data.copy.bus.retry}</Button>
    </Alert.Root>
  {:else if !preferencesReady}
    <Skeleton class="h-9 w-32" />
  {/if}
  {#key plannerVersion}
  <BusTab
    busCopy={data.copy.bus}
    bus={busData}
    compact
    savePreferences={signedIn && preferencesReady}
    onPlannerChange={() => { plannerInteracted = true; }}
  />
  {/key}
</PageLayout>
