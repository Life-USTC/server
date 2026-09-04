<script lang="ts">
import type { WorkspaceTodosCopy } from "@/features/workspace/lib/workspace-controller-types";
import WorkspaceEmptyState from "./WorkspaceEmptyState.svelte";

export let todosCopy: WorkspaceTodosCopy;
</script>

<WorkspaceEmptyState
  className="md:col-span-2"
  title={String(todosCopy.filterEmptyTitle)}
  description={String(todosCopy.filterEmptyDescription)}
/>
