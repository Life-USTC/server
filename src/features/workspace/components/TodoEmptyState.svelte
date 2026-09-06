<script lang="ts">
import type { WorkspaceTodosCopy } from "@/features/workspace/lib/workspace-controller-types";
import * as Empty from "$lib/components/ui/empty/index.js";

export let todosCopy: WorkspaceTodosCopy;
</script>

<Empty.Root class="md:col-span-2">
  <Empty.Header>
    <Empty.Title>{todosCopy.filterEmptyTitle}</Empty.Title>
    <Empty.Description>{todosCopy.filterEmptyDescription}</Empty.Description>
  </Empty.Header>
</Empty.Root>
