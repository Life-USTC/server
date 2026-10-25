<script lang="ts">
import { Button } from "#lib/components/ui/button/index.js";
import { Spinner } from "#lib/components/ui/spinner/index.js";
import type {
  EndlessScrollLabels,
  EndlessScrollState,
} from "@/lib/navigation/endless-list.svelte";

let {
  state: feed,
  labels,
}: { state: EndlessScrollState; labels: EndlessScrollLabels } = $props();
let sentinel: HTMLDivElement | undefined = $state();

$effect(() => {
  if (!sentinel || !feed.hasMore || feed.loading || feed.error) return;
  const observer = new IntersectionObserver((entries) => {
    if (entries.some((entry) => entry.isIntersecting)) void feed.loadMore();
  });
  observer.observe(sentinel);
  return () => observer.disconnect();
});
</script>

{#if feed.hasMore}
  <div bind:this={sentinel} class="flex w-full flex-col items-center gap-2 py-3" data-slot="endless-scroll" aria-busy={feed.loading}>
    {#if feed.error}<p role="status" class="text-sm text-muted-foreground">{labels.failed}</p>{/if}
    {#if feed.loading}
      <p role="status" class="flex items-center gap-2 text-sm text-muted-foreground"><Spinner />{labels.loading}</p>
    {:else}
      <Button href={feed.nextHref} variant="outline" onclick={(event) => { event.preventDefault(); void feed.loadMore(); }}>{feed.error ? labels.retry : labels.loadMore}</Button>
    {/if}
  </div>
{/if}
