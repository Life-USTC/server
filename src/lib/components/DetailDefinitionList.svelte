<script lang="ts">
import { cn } from "$lib/utils.js";
import {
  detailDefinitionListClass,
  detailDefinitionTermClass,
} from "./detail-definition-list";

let {
  class: className = "",
  items,
}: {
  class?: string;
  items: { label: string; value: string }[];
} = $props();
</script>

<dl class={cn(detailDefinitionListClass, className)}>
  {#each items as item (item.label)}
    <div class="contents">
      <dt class={detailDefinitionTermClass}>{item.label}</dt>
      <dd class="min-w-0 break-words">{item.value}</dd>
    </div>
  {/each}
</dl>
