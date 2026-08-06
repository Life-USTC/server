<script lang="ts">
import type { DashboardFocusItem } from "@/features/dashboard/lib/dashboard-agenda";
import SoftEmptyMessage from "$lib/components/SoftEmptyMessage.svelte";
import { Badge } from "$lib/components/ui/badge/index.js";
import OverviewSection from "./OverviewSection.svelte";

export let copy: {
  next: string;
  noUpcoming: string;
  now: string;
  title: string;
  urgent: string;
};
export let focus: DashboardFocusItem | null;

function statusLabel(status: DashboardFocusItem["status"]) {
  if (status === "now") return copy.now;
  if (status === "urgent") return copy.urgent;
  return copy.next;
}
</script>

<OverviewSection testId="dashboard-overview-focus" title={copy.title}>
  {#if focus}
    <a
      class="grid gap-2 rounded-lg py-1 transition-colors hover:bg-muted/40 -mx-2 px-2"
      href={focus.href}
    >
      <div class="flex flex-wrap items-center gap-2">
        <Badge variant={focus.status === "urgent" ? "destructive" : "secondary"}>
          {statusLabel(focus.status)}
        </Badge>
        <span class="text-muted-foreground text-xs">
          {focus.weekdayLabel} · {focus.dateLabel}
        </span>
      </div>
      <div class="font-medium text-lg tracking-tight">{focus.title}</div>
      <p class="text-muted-foreground text-sm">
        {focus.label}{focus.meta ? ` · ${focus.meta}` : ""}
      </p>
    </a>
  {:else}
    <SoftEmptyMessage message={copy.noUpcoming} />
  {/if}
</OverviewSection>
