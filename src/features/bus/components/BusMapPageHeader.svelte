<script lang="ts">
import RefreshCw from "@lucide/svelte/icons/refresh-cw";
import type { BusMapCopy } from "@/features/bus/lib/bus-map-types";
import PageHeader from "$lib/components/PageHeader.svelte";
import { Badge } from "$lib/components/ui/badge/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import { Spinner } from "$lib/components/ui/spinner/index.js";

export let copy: BusMapCopy;
export let refreshMap: () => void | Promise<void>;
export let refreshing: boolean;
</script>

<PageHeader title={copy.title}>
  {#snippet titleExtra()}
    <Badge class="ml-3 align-middle" variant="outline">{copy.experimental}</Badge>
  {/snippet}
  {#snippet actions()}
    <Button
      class="h-11 md:h-8"
      variant="outline"
      type="button"
      aria-label={copy.refresh}
      onclick={refreshMap}
    >
      {#if refreshing}
        <Spinner data-icon="inline-start" />
      {:else}
        <RefreshCw data-icon="inline-start" />
      {/if}
      <span>{copy.refresh}</span>
    </Button>
  {/snippet}
</PageHeader>
