<script lang="ts">
import LayoutGrid from "@lucide/svelte/icons/layout-grid";
import List from "@lucide/svelte/icons/list";
import SearchIcon from "@lucide/svelte/icons/search";
import type {
  DashboardDashboardCopy,
  LinkView,
} from "@/features/dashboard/lib/dashboard-controller-helpers";
import * as Field from "$lib/components/ui/field/index.js";
import * as InputGroup from "$lib/components/ui/input-group/index.js";
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
  <Field.Group class="min-w-60 flex-1 max-w-xl gap-0">
    <Field.Field>
      <Field.Label class="sr-only" for="anonymous-link-search">{dashboardCopy.linkHub.searchPlaceholder}</Field.Label>
      <InputGroup.Root>
        <InputGroup.Input
          id="anonymous-link-search"
          bind:ref={linkSearchInput}
          placeholder={dashboardCopy.linkHub.searchPlaceholder}
          type="search"
          value={linkSearchQuery}
          oninput={(event: Event) => {
            linkSearchQuery = (event.currentTarget as HTMLInputElement).value;
          }}
        />
        <InputGroup.Addon>
          <SearchIcon />
        </InputGroup.Addon>
      </InputGroup.Root>
    </Field.Field>
  </Field.Group>
</div>
