<script lang="ts">
import SearchIcon from "@lucide/svelte/icons/search";
import type { DashboardDashboardCopy } from "@/features/workspace/lib/dashboard-controller-helpers";
import PageSearchShortcutHint from "$lib/components/shell/PageSearchShortcutHint.svelte";
import * as Field from "$lib/components/ui/field/index.js";
import * as InputGroup from "$lib/components/ui/input-group/index.js";

export let dashboardCopy: DashboardDashboardCopy;
export let linkSearchInput: HTMLInputElement | null;
export let linkSearchQuery: string;
</script>

<div class="flex min-w-0 flex-wrap items-end gap-2">
  <Field.Group class="min-w-60 flex-1 max-w-xl gap-0">
    <Field.Field>
      <Field.Label class="sr-only" for="dashboard-link-search"
        >{dashboardCopy.linkHub.searchPlaceholder}</Field.Label
      >
      <InputGroup.Root>
        <InputGroup.Input
          id="dashboard-link-search"
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
        <InputGroup.Addon align="inline-end">
          <PageSearchShortcutHint />
        </InputGroup.Addon>
      </InputGroup.Root>
    </Field.Field>
  </Field.Group>
</div>
