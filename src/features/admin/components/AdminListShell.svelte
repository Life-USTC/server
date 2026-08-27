<script lang="ts">
import type { Snippet } from "svelte";
import { cn } from "$lib/utils.js";

type Props = {
  children: Snippet;
  class?: string;
};

let { children, class: className = "" }: Props = $props();
</script>

<div class={cn("min-w-0 max-w-full border-y", className)} data-slot="admin-list-shell">
  {@render children()}
</div>
