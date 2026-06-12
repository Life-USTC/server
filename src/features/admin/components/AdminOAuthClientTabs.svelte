<script lang="ts">
import * as Tabs from "$lib/components/ui/tabs/index.js";

type ClientTab = "trusted" | "public" | "disabled" | "all";

export let activeClientTab: ClientTab;
export let clientTabs: readonly (readonly [ClientTab, string])[];
export let copy: { clientGroupsLabel: string };
</script>

<Tabs.Root>
  <Tabs.List aria-label={copy.clientGroupsLabel}>
    {#each clientTabs as [id, label]}
      <Tabs.Button
        selected={activeClientTab === id}
        onclick={() => {
          activeClientTab = id;
        }}
      >
        {label}
      </Tabs.Button>
    {/each}
  </Tabs.List>
</Tabs.Root>
