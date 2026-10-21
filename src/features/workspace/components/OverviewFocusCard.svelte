<script lang="ts">
import { Badge } from "#lib/components/ui/badge/index.js";
import type { WorkspaceFocusItem } from "@/features/workspace/lib/workspace-agenda";
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
let className = "";

export { className as class };

function statusLabel(status: WorkspaceFocusItem["status"]) {
  if (status === "now") return copy.now;
  if (status === "urgent") return copy.urgent;
  return copy.next;
}
</script>

<OverviewSection class={className} testId="workspace-overview-focus" title={copy.title}>
  {#if focus}
    <a
      class="-mx-2 grid gap-2 rounded-lg px-2 py-1 transition-colors hover:bg-muted/40 lg:mx-0 lg:gap-1.5 lg:rounded-xl lg:border lg:bg-muted/25 lg:px-5 lg:py-4 lg:hover:bg-muted/50"
      href={focus.href}
    >
      <div class="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
        <div data-testid="overview-focus-title" class="min-w-0 break-words font-medium text-lg tracking-tight lg:text-xl">{focus.title}</div>
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
      <div class="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5 text-muted-foreground text-sm">
        <span class="text-xs">
          <span data-testid="overview-focus-weekday">{focus.weekdayLabel}</span> · <span data-testid="overview-focus-date">{focus.dateLabel}</span>
        </span>
        {#if focus.detail}
          <p class="min-w-0 break-words" data-testid="overview-focus-detail">{focus.detail}</p>
        {/if}
      </div>
    </a>
  {:else if loadingLabel}
    <p role="status" class="text-muted-foreground text-sm">{loadingLabel}</p>
  {:else}
    <p class="text-muted-foreground text-sm">{copy.noUpcoming}</p>
  {/if}
</OverviewSection>
