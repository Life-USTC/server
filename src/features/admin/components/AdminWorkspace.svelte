<script lang="ts">
import type { Snippet } from "svelte";
import PageLayout from "$lib/components/PageLayout.svelte";

type Props = {
  children: Snippet;
  controls?: Snippet;
  feedback?: Snippet;
  header: Snippet;
  summary?: Snippet;
};

let { children, controls, feedback, header, summary }: Props = $props();
</script>

<div data-testid="admin-workspace">
  <PageLayout width="full" {header}>
    {#if feedback}{@render feedback()}{/if}
    {#if summary}{@render summary()}{/if}
    {#if controls}{@render controls()}{/if}
    {@render children()}
  </PageLayout>
</div>
