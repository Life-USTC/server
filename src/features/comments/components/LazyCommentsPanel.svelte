<script lang="ts">
import { type ComponentProps, onMount } from "svelte";
import LazyModuleStatus from "#lib/components/LazyModuleStatus.svelte";
import type CommentsPanelComponent from "./CommentsPanel.svelte";

type PanelProps = ComponentProps<typeof CommentsPanelComponent>;

export let targetType: PanelProps["targetType"];
export let targetId: number | string;
export let initialData: PanelProps["initialData"];
export let permalinkBaseHref: string;
export let heading: string;
export let copy: { loadFailed: string; retry: string };
export let readOnlyReason: string | undefined = undefined;

let CommentsPanel: typeof CommentsPanelComponent | null = null;
let loadError = false;
let loading = false;
let destroyed = false;

async function loadPanel() {
  if (destroyed || loading) return;
  loading = true;
  loadError = false;
  try {
    const result = await import("./CommentsPanel.svelte");
    if (!destroyed) CommentsPanel = result.default;
  } catch {
    if (!destroyed) loadError = true;
  } finally {
    if (!destroyed) loading = false;
  }
}

onMount(() => {
  void loadPanel();
  return () => {
    destroyed = true;
  };
});
</script>

{#if CommentsPanel}
  <svelte:component
    this={CommentsPanel}
    {initialData}
    {permalinkBaseHref}
    {targetType}
    {targetId}
    {heading}
    {readOnlyReason}
  />
{:else}
  <h2 class="mb-3 text-lg font-semibold tracking-tight">{heading}</h2>
  <LazyModuleStatus failed={loadError} {heading} loadFailed={copy.loadFailed} retry={copy.retry} onRetry={() => void loadPanel()} />
{/if}
