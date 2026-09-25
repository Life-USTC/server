<script lang="ts">
import { type ComponentProps, onMount } from "svelte";
import * as Alert from "$lib/components/ui/alert/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import { Skeleton } from "$lib/components/ui/skeleton/index.js";
import type CommentsPanelComponent from "./CommentsPanel.svelte";

type PanelProps = ComponentProps<typeof CommentsPanelComponent>;

export let targetType: PanelProps["targetType"];
export let targetId: number | string;
export let initialData: PanelProps["initialData"];
export let permalinkBaseHref: string;
export let heading: string;
export let copy: { loadFailed: string; retry: string };

let CommentsPanel: typeof CommentsPanelComponent | null = null;
let loadError = false;

async function loadPanel() {
  loadError = false;
  try {
    CommentsPanel = (await import("./CommentsPanel.svelte")).default;
  } catch {
    loadError = true;
  }
}

onMount(() => {
  void loadPanel();
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
  />
{:else if loadError}
  <Alert.Root variant="destructive">
    <Alert.Description>{copy.loadFailed}</Alert.Description>
    <Alert.Action>
      <Button size="sm" variant="ghost" onclick={() => void loadPanel()}>
        {copy.retry}
      </Button>
    </Alert.Action>
  </Alert.Root>
{:else}
  <div class="grid gap-3" aria-busy="true" aria-label={heading}>
    <Skeleton class="h-5 w-24" />
    <Skeleton class="h-16 w-full" />
  </div>
{/if}
