<script lang="ts">
import type { Snippet } from "svelte";

type Props = {
  children: Snippet;
  controls?: Snippet;
  feedback?: Snippet;
  header: Snippet;
  summary?: Snippet;
};

let { children, controls, feedback, header, summary }: Props = $props();
</script>

<div class="page-frame page-frame-full w-full min-w-0">
  <section
    class="grid min-w-0 gap-8 [&>header]:min-w-0 [&>section]:min-w-0 [&>div]:min-w-0"
    data-testid="admin-workspace"
  >
    {@render header()}
    {#if feedback}{@render feedback()}{/if}
    {#if summary}{@render summary()}{/if}
    {#if controls}{@render controls()}{/if}
    {@render children()}
  </section>
</div>
