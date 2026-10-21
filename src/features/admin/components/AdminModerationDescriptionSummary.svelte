<script lang="ts">
import ResultsSummary from "#lib/components/ResultsSummary.svelte";
import type { AdminModerationDescriptionCopy } from "./admin-moderation-description-types";

export let copy: AdminModerationDescriptionCopy;
export let count: number;
export let formatMessage: (
  template: string,
  values: Record<string, string>,
) => string;
</script>

<ResultsSummary
  summary={formatMessage(count === 1 ? copy.showingResultsOne : copy.showingResults, {
      count: String(count),
    })}
/>
