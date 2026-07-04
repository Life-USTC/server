<script lang="ts">
import * as ToggleGroup from "$lib/components/ui/toggle-group/index.js";

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

<ToggleGroup.Root
  aria-label={copy.clientGroupsLabel}
  type="single"
  value={activeClientTab}
  variant="outline"
  onValueChange={handleClientTabChange}
>
  {#each clientTabs as [id, label]}
    <ToggleGroup.Item value={id}>{label}</ToggleGroup.Item>
  {/each}
</ToggleGroup.Root>
