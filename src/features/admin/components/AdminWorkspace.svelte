<script lang="ts">
import type { Snippet } from "svelte";
import PageFrame from "$lib/components/PageFrame.svelte";

type Props = {
  children: Snippet;
  controls?: Snippet;
  feedback?: Snippet;
  header: Snippet;
  summary?: Snippet;
};

let { children, controls, feedback, header, summary }: Props = $props();
</script>

<PageFrame>
  <section class="grid grid-cols-[minmax(0,1fr)] gap-5" data-testid="admin-workspace">
    {@render header()}
    {#if feedback}{@render feedback()}{/if}
    {#if summary}{@render summary()}{/if}
    {#if controls}{@render controls()}{/if}
    {@render children()}
  </section>
</PageFrame>
