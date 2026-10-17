<script lang="ts">
import type { Snippet } from "svelte";
import {
  collectionCompactClass,
  collectionDesktopScrollClass,
} from "#lib/components/collection-responsive-breakpoint.js";
import { cn } from "#lib/utils.js";

type Props = {
  class?: string;
  desktopClass?: string;
  desktop: Snippet;
  mobile: Snippet;
};

let {
  class: className = "",
  desktopClass = "",
  desktop,
  mobile,
}: Props = $props();
</script>

<div
  class={cn("min-w-0", className)}
  data-slot="workspace-collection"
>
  <div class={collectionCompactClass} data-slot="workspace-collection-mobile">
    {@render mobile()}
  </div>
  <div
    class={cn(collectionDesktopScrollClass, desktopClass)}
    data-slot="workspace-collection-desktop"
  >
    {@render desktop()}
  </div>
</div>
