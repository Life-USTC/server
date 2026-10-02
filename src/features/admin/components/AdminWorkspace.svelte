<script lang="ts">
import type { Snippet } from "svelte";
import CollectionPage from "$lib/components/CollectionPage.svelte";

type Props = {
  children: Snippet;
  controls?: Snippet;
  feedback?: Snippet;
  header: Snippet;
  summary?: Snippet;
};

let {
  children,
  controls,
  feedback,
  header: pageHeader,
  summary,
}: Props = $props();
</script>

<div data-testid="admin-workspace">
  <CollectionPage panel={false} width="full">
    {#snippet header()}{@render pageHeader()}{/snippet}
    {#snippet before()}
      {#if feedback}{@render feedback()}{/if}
      {#if summary}{@render summary()}{/if}
      {#if controls}{@render controls()}{/if}
    {/snippet}
    {@render children()}
  </CollectionPage>
</div>
