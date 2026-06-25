<script lang="ts">
import type {
  AnonymousLinkGroup,
  LinkView,
} from "@/features/dashboard/lib/dashboard-controller-helpers";
import * as Table from "$lib/components/ui/table/index.js";
import DashboardLinkVisitAction from "./DashboardLinkVisitAction.svelte";

export let entry: AnonymousLinkGroup;
export let linkIconLabel: (icon: string) => string;
export let linkView: LinkView;
</script>

<section class="grid gap-2">
  <h3 class="font-medium text-base-content/60 text-sm">
    {entry.label}
  </h3>
  {#if linkView === "grid"}
    <div class="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
      {#each entry.links as link}
        <div class="group relative min-w-0 overflow-hidden rounded-md border border-base-300 bg-base-100 transition hover:border-primary hover:bg-base-200/50">
          <DashboardLinkVisitAction {link} {linkIconLabel} />
        </div>
      {/each}
    </div>
  {:else}
    <Table.Root>
      <Table.Body>
        {#each entry.links as link}
          <Table.Row>
            <Table.Cell class="p-0">
              <DashboardLinkVisitAction {link} {linkIconLabel} variant="row" />
            </Table.Cell>
          </Table.Row>
        {/each}
      </Table.Body>
    </Table.Root>
  {/if}
</section>
