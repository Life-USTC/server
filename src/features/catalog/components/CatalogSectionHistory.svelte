<script lang="ts">
import type { Snippet } from "svelte";
import EndlessScroll from "#lib/components/EndlessScroll.svelte";
import type {
  EndlessScrollLabels,
  EndlessScrollState,
} from "@/lib/navigation/endless-list.svelte";

let {
  state,
  labels,
  children,
}: {
  state: EndlessScrollState;
  labels: EndlessScrollLabels;
  children: Snippet;
} = $props();
</script>

<div class="grid gap-4" data-testid="section-history">
  {@render children()}
  <EndlessScroll {state} {labels} />
</div>
