<script lang="ts">
import type { DashboardTodosCopy } from "@/features/dashboard/lib/dashboard-controller-types";
import * as Card from "$lib/components/ui/card/index.js";

export let todosCopy: DashboardTodosCopy;
</script>

<Card.Root class="md:col-span-2">
  <Card.Content class="grid gap-1 pt-5 text-center">
    <p class="font-medium">{todosCopy.filterEmptyTitle}</p>
    <p class="text-base-content/60 text-sm">
      {todosCopy.filterEmptyDescription}
    </p>
  </Card.Content>
</Card.Root>
