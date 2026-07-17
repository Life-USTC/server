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

<section class="grid gap-5" data-testid="admin-workspace">
  {@render header()}
  {#if feedback}{@render feedback()}{/if}
  {#if summary}{@render summary()}{/if}
  {#if controls}{@render controls()}{/if}
  {@render children()}
</section>
