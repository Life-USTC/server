<script lang="ts">
import type { Snippet } from "svelte";
import { cn } from "$lib/utils.js";

type Props = {
  class?: string;
  desktop: Snippet;
  mobile: Snippet;
};

let { class: className = "", desktop, mobile }: Props = $props();
</script>

<div
  class={cn("min-w-0", className)}
  data-slot="responsive-collection"
>
  <div class="xl:hidden" data-slot="responsive-collection-mobile">
    {@render mobile()}
  </div>
  <div class="hidden xl:block" data-slot="responsive-collection-desktop">
    {@render desktop()}
  </div>
</div>
