<script lang="ts">
import { Badge } from "#lib/components/ui/badge/index.js";
import type { AdminBusCopy, AdminBusVersion } from "./admin-bus-types";

interface Props {
  copy: AdminBusCopy;
  version: AdminBusVersion;
}

let { copy, version }: Props = $props();
</script>

{#if version.isEnabled}
  <Badge>{copy.statusActive}</Badge>
{:else}
  <Badge variant="ghost">{copy.statusInactive}</Badge>
{/if}
