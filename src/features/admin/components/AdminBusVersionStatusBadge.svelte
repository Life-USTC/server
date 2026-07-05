<script lang="ts">
import { Badge } from "$lib/components/ui/badge/index.js";
import type { AdminBusCopy, AdminBusVersion } from "./admin-bus-types";

export let copy: AdminBusCopy;
export let version: AdminBusVersion;
</script>

{#if version.isEnabled}
  <Badge>{copy.statusActive}</Badge>
{:else}
  <Badge variant="ghost">{copy.statusInactive}</Badge>
{/if}
