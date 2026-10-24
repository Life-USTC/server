<script lang="ts">
import SearchField from "#lib/components/SearchField.svelte";
import type { WorkspaceCopy } from "@/features/workspace/lib/workspace-controller-helpers";

export let workspaceCopy: Pick<WorkspaceCopy, "linkHub">;
export let linkSearchQuery: string;
export let id: string;
export let onchange: ((value: string) => void) | undefined = undefined;
</script>

    <SearchField
      {id}
      form="links-filters"
      label={workspaceCopy.linkHub.searchPlaceholder}
      placeholder={workspaceCopy.linkHub.searchPlaceholder}
      value={linkSearchQuery}
      oninput={(event) => { linkSearchQuery = event.currentTarget.value; onchange?.(linkSearchQuery); }}
    />
