<script lang="ts">
import type { Snippet } from "svelte";
import {
  collectionCompactClass,
  collectionDesktopClass,
  collectionDesktopScrollClass,
} from "#lib/components/collection-responsive-breakpoint.js";
import { cn } from "#lib/utils.js";

type Props = {
  class?: string;
  workspace?: boolean;
  desktop: Snippet;
  mobile: Snippet;
};

let {
  class: className = "",
  workspace = false,
  desktop,
  mobile,
}: Props = $props();
const slot = $derived(
  workspace ? "workspace-collection" : "responsive-collection",
);
</script>

<div
  class={cn("min-w-0", className)}
  data-slot={slot}
>
  <div class={collectionCompactClass} data-slot={`${slot}-mobile`}>
    {@render mobile()}
  </div>
  <div class={workspace ? collectionDesktopScrollClass : collectionDesktopClass} data-slot={`${slot}-desktop`}>
    {@render desktop()}
  </div>
</div>
