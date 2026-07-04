<script lang="ts">
import * as Tabs from "$lib/components/ui/tabs/index.js";

type ClientTab = "trusted" | "public" | "disabled" | "all";

export let activeClientTab: ClientTab;
export let clientTabs: readonly (readonly [ClientTab, string])[];
export let copy: { clientGroupsLabel: string };

function handleClientTabChange(value: string) {
  if (
    value === "trusted" ||
    value === "public" ||
    value === "disabled" ||
    value === "all"
  ) {
    activeClientTab = value;
  }
}
</script>

<Tabs.Root value={activeClientTab} onValueChange={handleClientTabChange}>
  <Tabs.List aria-label={copy.clientGroupsLabel}>
    {#each clientTabs as [id, label]}
      <Tabs.Trigger value={id}>{label}</Tabs.Trigger>
    {/each}
  </Tabs.List>
</Tabs.Root>
