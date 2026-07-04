<script lang="ts">
import type {
  DashboardDashboardCopy,
  LinkView,
} from "@/features/dashboard/lib/dashboard-controller-helpers";
import LayoutGrid from "$lib/components/icons/layout-grid.svelte";
import List from "$lib/components/icons/list.svelte";
import { Input } from "$lib/components/ui/input/index.js";
import * as ToggleGroup from "$lib/components/ui/toggle-group/index.js";

export let dashboardCopy: DashboardDashboardCopy;
export let linkSearchInput: HTMLInputElement | null;
export let linkSearchQuery: string;
export let linkView: LinkView;
export let setLinkView: (view: LinkView) => void;

function handleLinkViewChange(value: string) {
  if (value === "grid" || value === "list") {
    setLinkView(value);
  }
}
</script>

<div class="flex min-w-0 flex-wrap items-end gap-2">
  <ToggleGroup.Root
    aria-label={dashboardCopy.linkHub.viewMode}
    type="single"
    value={linkView}
    variant="outline"
    onValueChange={handleLinkViewChange}
  >
    <ToggleGroup.Item value="grid">
      <LayoutGrid data-icon="inline-start" />
      {dashboardCopy.linkHub.gridView}
    </ToggleGroup.Item>
    <ToggleGroup.Item value="list">
      <List data-icon="inline-start" />
      {dashboardCopy.linkHub.listView}
    </ToggleGroup.Item>
  </ToggleGroup.Root>
  <label class="grid min-w-60 flex-1 max-w-xl">
    <Input
      aria-label={dashboardCopy.linkHub.searchPlaceholder}
      bind:ref={linkSearchInput}
      placeholder={dashboardCopy.linkHub.searchPlaceholder}
      type="search"
      value={linkSearchQuery}
      oninput={(event: Event) => {
        linkSearchQuery = (event.currentTarget as HTMLInputElement).value;
      }}
    />
  </label>
</div>
