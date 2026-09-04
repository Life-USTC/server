<script lang="ts">
import BusTab from "./BusTab.svelte";
import type { DashboardPublicBusProps } from "./dashboard-calendar-component-types";

export let busCopy: DashboardPublicBusProps["busCopy"];
export let signedData: DashboardPublicBusProps["signedData"];
</script>

<BusTab
  {busCopy}
  bus={signedData.bus ?? null}
  savePreferences={true}
/>
