<script lang="ts">
import type {
  AdminDashboardCopy,
  AdminDashboardQueueCard,
} from "@/features/admin/lib/admin-dashboard-card-data";
import { Badge } from "$lib/components/ui/badge/index.js";
import * as Card from "$lib/components/ui/card/index.js";

export let copy: AdminDashboardCopy;
export let queueCards: AdminDashboardQueueCard[];
</script>

<Card.Root>
  <Card.Header>
    <Card.Title>{copy.dashboard.queuesTitle}</Card.Title>
    <Card.Description>
      {copy.dashboard.queuesDescription}
    </Card.Description>
  </Card.Header>
  <Card.Content>
    <div class="grid gap-3 sm:grid-cols-3">
      {#each queueCards as queue}
        <a
          class="rounded-md border border-base-300 bg-base-100 p-3 no-underline transition hover:border-primary hover:bg-base-200/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          href={queue.href}
        >
          <div class="flex items-center justify-between gap-3">
            <span class="font-medium">{queue.label}</span>
            <Badge variant="ghost">{queue.value}</Badge>
          </div>
          <p class="mt-1 text-base-content/60 text-sm">
            {queue.meta}
          </p>
        </a>
      {/each}
    </div>
  </Card.Content>
</Card.Root>
