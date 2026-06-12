<script lang="ts">
import type {
  DashboardBusCopy,
  DashboardBusData,
} from "@/features/dashboard/lib/bus-tab-types";

export let bus: DashboardBusData;
export let busCopy: DashboardBusCopy;
export let busShowsEstimatedHint: boolean;
</script>

{#if bus.notice?.message || busShowsEstimatedHint}
  <div class="grid justify-items-end gap-2 text-right text-base-content/60 text-xs">
    {#if bus.notice?.message}
      {#if bus.notice.url}
        <a
          class="underline underline-offset-2"
          href={bus.notice.url}
          rel="noreferrer"
          target="_blank"
        >
          {bus.notice.message}
        </a>
      {:else}
        <p>{bus.notice.message}</p>
      {/if}
    {/if}
    {#if busShowsEstimatedHint}
      <p>{busCopy.planner.estimatedHint}</p>
    {/if}
  </div>
{/if}
