<script lang="ts">
import CollectionEmpty from "#lib/components/CollectionEmpty.svelte";

export let title: string;
export let description: string | undefined = undefined;
export let clearFilterLabel: string;
export let onClearFilter: (() => void) | undefined = undefined;
</script>

<CollectionEmpty
  class="min-h-24 py-8"
  clearFilterLabel={clearFilterLabel}
  description={description ?? ""}
  onClearFilter={onClearFilter}
  title={title}
  variant="filter-clear"
/>
