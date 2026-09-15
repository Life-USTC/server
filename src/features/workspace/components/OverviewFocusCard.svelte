<script lang="ts">
import type { WorkspaceFocusItem } from "@/features/workspace/lib/workspace-agenda";
import { Badge } from "$lib/components/ui/badge/index.js";
import * as Empty from "$lib/components/ui/empty/index.js";
import OverviewSection from "./OverviewSection.svelte";

export let copy: {
  next: string;
  noUpcoming: string;
  now: string;
  title: string;
  urgent: string;
};
export let focus: WorkspaceFocusItem | null;

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
    <Empty.Root class="min-h-20 border-0 px-2 py-6">
      <Empty.Header>
        <Empty.Description>{copy.noUpcoming}</Empty.Description>
      </Empty.Header>
    </Empty.Root>
  {/if}
</OverviewSection>
