<script lang="ts">
import SearchField from "#lib/components/SearchField.svelte";
import type { WorkspaceCopy } from "@/features/workspace/lib/workspace-controller-helpers";

export let workspaceCopy: Pick<WorkspaceCopy, "linkHub">;
export let linkSearchQuery: string;
export let id: string;
</script>

    <SearchField
      {id}
      label={workspaceCopy.linkHub.searchPlaceholder}
      placeholder={workspaceCopy.linkHub.searchPlaceholder}
      bind:value={linkSearchQuery}
    />
