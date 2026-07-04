<script lang="ts">
import type { BusMapCopy, BusMapData } from "@/features/bus/lib/bus-map-types";
import RefreshCw from "$lib/components/icons/refresh-cw.svelte";
import PageHeader from "$lib/components/PageHeader.svelte";
import { Badge } from "$lib/components/ui/badge/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import * as Item from "$lib/components/ui/item/index.js";
import { Spinner } from "$lib/components/ui/spinner/index.js";

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
      {#if refreshing}
        <Spinner data-icon="inline-start" />
      {:else}
        <RefreshCw data-icon="inline-start" />
      {/if}
      <span>{copy.refresh}</span>
    </Button>
  {/snippet}

  {#snippet after()}
    {#if mapData}
      <Item.Group class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Item.Root class="items-start" variant="outline">
          <Item.Content>
            <Item.Description>{copy.serviceDay}</Item.Description>
            <Item.Title>{dayTypeLabel}</Item.Title>
          </Item.Content>
        </Item.Root>
        <Item.Root class="items-start" variant="outline">
          <Item.Content>
            <Item.Description>{copy.routes}</Item.Description>
            <Item.Title>{mapData.routes.length}</Item.Title>
          </Item.Content>
        </Item.Root>
        <Item.Root class="items-start" variant="outline">
          <Item.Content>
            <Item.Description>{copy.tripsToday}</Item.Description>
            <Item.Title>{totalTripsForToday}</Item.Title>
          </Item.Content>
        </Item.Root>
        <Item.Root class="items-start" variant="outline">
          <Item.Content>
            <Item.Description>{copy.updated}</Item.Description>
            <Item.Title>{updatedTime}</Item.Title>
          </Item.Content>
        </Item.Root>
      </Item.Group>
    {/if}
  {/snippet}
</PageHeader>
