<script lang="ts">
import type { BusMapCopy, BusMapData } from "@/features/bus/lib/bus-map-types";
import RefreshCw from "$lib/components/icons/refresh-cw.svelte";
import PageHeader from "$lib/components/PageHeader.svelte";
import { Badge } from "$lib/components/ui/badge/index.js";
import { Button } from "$lib/components/ui/button/index.js";

export let copy: BusMapCopy;
export let dayTypeLabel: string;
export let mapData: BusMapData | null;
export let refreshMap: () => void | Promise<void>;
export let refreshing: boolean;
export let totalTripsForToday: number;
export let updatedTime: string;
</script>

<PageHeader title={copy.title} description={copy.subtitle}>
  {#snippet eyebrowContent()}
    <Button class="w-fit p-0" href="/dashboard/bus" variant="link">{copy.backToBus}</Button>
  {/snippet}
  {#snippet titleExtra()}
    <Badge class="ml-3 align-middle" variant="outline">{copy.experimental}</Badge>
  {/snippet}
  {#snippet actions()}
    <Button variant="outline" size="sm" type="button" aria-label={copy.refresh} onclick={refreshMap}>
      <RefreshCw class={refreshing ? "animate-spin" : ""} />
      <span>{copy.refresh}</span>
    </Button>
  {/snippet}

  {#snippet after()}
    {#if mapData}
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div class="rounded-md border border-base-300 bg-base-200/40 p-3">
          <p class="text-base-content/60 text-xs">{copy.serviceDay}</p>
          <p class="mt-1 font-semibold">{dayTypeLabel}</p>
        </div>
        <div class="rounded-md border border-base-300 bg-base-200/40 p-3">
          <p class="text-base-content/60 text-xs">{copy.routes}</p>
          <p class="mt-1 font-semibold">{mapData.routes.length}</p>
        </div>
        <div class="rounded-md border border-base-300 bg-base-200/40 p-3">
          <p class="text-base-content/60 text-xs">{copy.tripsToday}</p>
          <p class="mt-1 font-semibold">{totalTripsForToday}</p>
        </div>
        <div class="rounded-md border border-base-300 bg-base-200/40 p-3">
          <p class="text-base-content/60 text-xs">{copy.updated}</p>
          <p class="mt-1 font-semibold">{updatedTime}</p>
        </div>
      </div>
    {/if}
  {/snippet}
</PageHeader>
