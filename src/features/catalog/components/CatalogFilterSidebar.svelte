<script lang="ts">
import { Badge } from "$lib/components/ui/badge/index.js";

export let activeCount = 0;
export let description = "";
export let title: string;
</script>

<aside
  class="w-full border-base-300 border-b bg-base-100 lg:sticky lg:top-12 lg:h-[calc(100vh-3rem)] lg:border-r lg:border-b-0"
  data-testid="catalog-filter-sidebar"
>
  <div class="h-full overflow-y-auto p-3">
    <div class="mb-4 flex items-start justify-between gap-3">
      <div class="min-w-0">
        <p class="font-medium text-base-content text-sm">{title}</p>
        {#if description}
          <p class="mt-0.5 text-base-content/60 text-xs">{description}</p>
        {/if}
      </div>
      {#if activeCount > 0}
        <Badge class="shrink-0" variant="secondary">{activeCount}</Badge>
      {/if}
    </div>
    <slot />
  </div>
</aside>
