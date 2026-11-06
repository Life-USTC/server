<script lang="ts">
import { Badge } from "#lib/components/ui/badge/index.js";
import type { HomeworkDetailCopy } from "./homework-detail-types";

export let completed: boolean;
export let completionRequired = true;
export let copy: Pick<
  HomeworkDetailCopy,
  "completedLabel" | "pendingLabel" | "noCompletionRequired"
>;
export let relativeLabel = "";
export let overdue = false;
</script>

<div class="flex min-w-0 flex-wrap items-center gap-2">
  {#if !completionRequired}
    <Badge variant="outline">{copy.noCompletionRequired}</Badge>
  {:else if completed}
    <Badge variant="secondary">{copy.completedLabel}</Badge>
  {:else}
    <Badge variant="outline">{copy.pendingLabel}</Badge>
    {#if relativeLabel}
      <Badge variant={overdue ? "status-overdue" : "ghost"} data-status-token={overdue ? "overdue" : undefined}>{relativeLabel}</Badge>
    {/if}
  {/if}
</div>
