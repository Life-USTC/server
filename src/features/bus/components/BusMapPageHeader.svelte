<script lang="ts">
import RefreshCw from "@lucide/svelte/icons/refresh-cw";
import PageHeader from "#lib/components/PageHeader.svelte";
import { Badge } from "#lib/components/ui/badge/index.js";
import { Button } from "#lib/components/ui/button/index.js";
import type { BusMapCopy } from "@/features/bus/lib/bus-map-types";

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
      loading={refreshing} icon={RefreshCw}
      variant="outline"
      aria-label={copy.refresh}
      onclick={refreshMap}
    >
      <span>{copy.refresh}</span>
    </Button>
  {/snippet}
</PageHeader>
