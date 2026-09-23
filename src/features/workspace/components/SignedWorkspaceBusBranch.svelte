<script lang="ts">
import BusTab from "./BusTab.svelte";
import type { WorkspacePublicBusProps } from "./workspace-calendar-component-types";

export let busCopy: WorkspacePublicBusProps["busCopy"];
export let signedData: WorkspacePublicBusProps["signedData"];
</script>

<BusTab
  {busCopy}
  bus={signedData.bus ?? null}
  savePreferences={true}
/>
