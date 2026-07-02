<script lang="ts">
import type { DashboardTodosCopy } from "@/features/dashboard/lib/dashboard-controller-types";
import * as Empty from "$lib/components/ui/empty/index.js";

export let todosCopy: DashboardTodosCopy;
</script>

<Empty.Root class="border border-base-300 bg-base-100 md:col-span-2">
  <Empty.Header>
    <Empty.Title>{todosCopy.filterEmptyTitle}</Empty.Title>
    <Empty.Description>{todosCopy.filterEmptyDescription}</Empty.Description>
  </Empty.Header>
</Empty.Root>
