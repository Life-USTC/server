<script lang="ts">
import { type ComponentProps, onMount } from "svelte";
import LazyModuleStatus from "#lib/components/LazyModuleStatus.svelte";
import type DescriptionCardComponent from "./DescriptionCard.svelte";

type CardProps = ComponentProps<typeof DescriptionCardComponent>;

export let targetType: CardProps["targetType"];
export let targetId: number | string;
export let initialData: CardProps["initialData"];
export let locale: CardProps["locale"];
export let copy: CardProps["copy"] & { retry: string };
export let heading: string;
export let resolveViewer = false;
export let readOnlyReason: string | undefined = undefined;

let DescriptionCard: typeof DescriptionCardComponent | null = null;
let loadError = false;
let loading = false;
let destroyed = false;

async function loadCard() {
  if (destroyed || loading) return;
  loading = true;
  loadError = false;
  try {
    const result = await import("./DescriptionCard.svelte");
    if (!destroyed) DescriptionCard = result.default;
  } catch {
    if (!destroyed) loadError = true;
  } finally {
    if (!destroyed) loading = false;
  }
}

onMount(() => {
  void loadCard();
  return () => {
    destroyed = true;
  };
});
</script>

{#if DescriptionCard}
  <svelte:component
    this={DescriptionCard}
    {resolveViewer}
    {targetType}
    {targetId}
    {initialData}
    {locale}
    {copy}
    {heading}
    {readOnlyReason}
    showTitle={false}
  />
{:else}
  <h2 class="mb-3 text-lg font-semibold tracking-tight">{heading}</h2>
  {#if initialData.description.renderedHtml}
    <div class="markdown-preview" data-slot="markdown-preview">{@html initialData.description.renderedHtml}</div>
  {/if}
  {#if loadError || !initialData.description.renderedHtml}
  <LazyModuleStatus failed={loadError} {heading} loadFailed={copy.loadFailed} retry={copy.retry} onRetry={() => void loadCard()} />
  {/if}
{/if}
