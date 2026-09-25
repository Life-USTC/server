<script lang="ts">
import type { WorkspaceCopy } from "@/features/workspace/lib/workspace-controller-helpers";
import FilterToolbar from "$lib/components/FilterToolbar.svelte";
import SearchField from "$lib/components/SearchField.svelte";

export let workspaceCopy: Pick<WorkspaceCopy, "linkHub">;
export let linkSearchQuery: string;
</script>

<FilterToolbar>
  {#snippet primary()}
    <SearchField
      id="catalog-link-search"
      label={workspaceCopy.linkHub.searchPlaceholder}
      placeholder={workspaceCopy.linkHub.searchPlaceholder}
      bind:value={linkSearchQuery}
    />
  {/snippet}
</FilterToolbar>
