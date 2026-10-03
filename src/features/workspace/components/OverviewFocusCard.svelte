<script lang="ts">
import type { WorkspaceFocusItem } from "@/features/workspace/lib/workspace-agenda";
import CompactEmpty from "$lib/components/CompactEmpty.svelte";
import { Badge } from "$lib/components/ui/badge/index.js";
import OverviewSection from "./OverviewSection.svelte";

export let copy: {
  next: string;
  noUpcoming: string;
  now: string;
  title: string;
  urgent: string;
};
export let focus: WorkspaceFocusItem | null;
export let loadingLabel: string | null;

function statusLabel(status: WorkspaceFocusItem["status"]) {
  if (status === "now") return copy.now;
  if (status === "urgent") return copy.urgent;
  return copy.next;
}
</script>

<OverviewSection testId="workspace-overview-focus" title={copy.title}>
  {#if focus}
    <a
      class="grid gap-2 rounded-lg py-1 transition-colors hover:bg-muted/40 -mx-2 px-2"
      href={focus.href}
    >
      <div class="grid gap-2">
        <div data-testid="overview-focus-title" class="font-medium text-lg tracking-tight">{focus.title}</div>
        <div class="flex flex-wrap items-center gap-2 text-sm">
          <Badge data-testid="overview-focus-status" variant={focus.status === "urgent" ? "destructive" : "secondary"}>
            {statusLabel(focus.status)}
          </Badge>
          <span data-testid="overview-focus-label">{focus.label}</span>
          {#if focus.time}
            <span data-testid="overview-focus-time" class="font-medium tabular-nums">{focus.time}</span>
          {/if}
        </div>
      </div>
      <div class="grid gap-1 text-muted-foreground text-sm">
        <div class="text-xs">
          <span data-testid="overview-focus-weekday">{focus.weekdayLabel}</span> · <span data-testid="overview-focus-date">{focus.dateLabel}</span>
        </div>
        {#if focus.detail}
          <p data-testid="overview-focus-detail">{focus.detail}</p>
        {/if}
      </div>
    </a>
  {:else if loadingLabel}
    <p role="status" class="py-6 text-muted-foreground text-sm">{loadingLabel}</p>
  {:else}
    <CompactEmpty description={copy.noUpcoming} />
  {/if}
</OverviewSection>
