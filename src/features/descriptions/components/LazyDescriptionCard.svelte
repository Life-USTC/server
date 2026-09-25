<script lang="ts">
import { type ComponentProps, onMount } from "svelte";
import * as Alert from "$lib/components/ui/alert/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import { Skeleton } from "$lib/components/ui/skeleton/index.js";
import type DescriptionCardComponent from "./DescriptionCard.svelte";

type CardProps = ComponentProps<typeof DescriptionCardComponent>;

export let targetType: CardProps["targetType"];
export let targetId: number | string;
export let initialData: CardProps["initialData"];
export let locale: CardProps["locale"];
export let copy: CardProps["copy"] & { retry: string };
export let heading: string;
export let resolveViewer = false;

let DescriptionCard: typeof DescriptionCardComponent | null = null;
let loadError = false;

async function loadCard() {
  loadError = false;
  try {
    DescriptionCard = (await import("./DescriptionCard.svelte")).default;
  } catch {
    loadError = true;
  }
}

onMount(() => {
  void loadCard();
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
    showTitle={false}
  />
{:else if initialData.description.renderedHtml}
  <h2 class="mb-3 text-lg font-semibold tracking-tight">{heading}</h2>
  <div class="markdown-preview" data-slot="markdown-preview">
    {@html initialData.description.renderedHtml}
  </div>
{:else if loadError}
  <Alert.Root variant="destructive">
    <Alert.Description>{copy.loadFailed}</Alert.Description>
    <Alert.Action>
      <Button size="sm" variant="ghost" onclick={() => void loadCard()}>
        {copy.retry}
      </Button>
    </Alert.Action>
  </Alert.Root>
{:else}
  <div class="grid gap-3" aria-busy="true" aria-label={heading}>
    <Skeleton class="h-5 w-28" />
    <Skeleton class="h-4 w-full" />
    <Skeleton class="h-4 w-11/12" />
    <Skeleton class="h-4 w-4/5" />
  </div>
{/if}
