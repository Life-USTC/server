<script lang="ts">
import { onMount } from "svelte";
import { Button } from "$lib/components/ui/button/index.js";
import { Spinner } from "$lib/components/ui/spinner/index.js";

export let auto = true;
export let hasMore = false;
export let loading = false;
export let loadingLabel: string;
export let loadMore: () => void | Promise<void>;
export let nextHref: string;
export let nextLabel: string;

let sentinel: HTMLDivElement | undefined;
let requesting = false;

async function requestMore() {
  if (!hasMore || loading || requesting) return;
  requesting = true;
  try {
    await loadMore();
  } finally {
    requesting = false;
  }
}

onMount(() => {
  if (!sentinel || typeof IntersectionObserver === "undefined") return;

  const observer = new IntersectionObserver(
    (entries) => {
      if (auto && entries.some((entry) => entry.isIntersecting)) {
        void requestMore();
      }
    },
    { rootMargin: "420px 0px" },
  );

  observer.observe(sentinel);

  return () => observer.disconnect();
});
</script>

{#if hasMore}
  <div bind:this={sentinel} class="flex justify-center py-5">
    <Button
      href={nextHref}
      disabled={loading}
      onclick={(event) => {
        event.preventDefault();
        void requestMore();
      }}
      variant="outline"
    >
      {#if loading}
        <Spinner data-icon="inline-start" />
      {/if}
      {loading ? loadingLabel : nextLabel}
    </Button>
  </div>
{/if}
