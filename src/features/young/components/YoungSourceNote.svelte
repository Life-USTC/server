<script lang="ts">
import type { YoungSourceFreshness } from "@/features/young/server/young-event-service";
import { youngDateTime } from "../lib/young-event-display";

type Props = {
  missing?: string | null;
  source: YoungSourceFreshness;
  labels: {
    sourceFresh: string;
    sourceStale: string;
    sourceUnknown: string;
  };
};

let { labels, missing = null, source }: Props = $props();

const syncedAt = $derived(youngDateTime(source.lastSyncedAt));
</script>

<p class="w-full text-right text-xs text-muted-foreground" data-testid="young-source-freshness">
  {#if source.status === "fresh"}
    {labels.sourceFresh}
  {:else if source.status === "stale"}
    {labels.sourceStale}
  {:else}
    {labels.sourceUnknown}
  {/if}
  {#if syncedAt} · {syncedAt}{/if}
  {#if missing}<span> · {missing}</span>{/if}
</p>
