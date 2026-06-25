<script lang="ts">
import type {
  DashboardLinkPinAction,
  DashboardLinkPinSubmit,
  DashboardOverviewLinkItem,
} from "@/features/dashboard/lib/dashboard-controller-helpers";
import * as Table from "$lib/components/ui/table/index.js";
import DashboardLinkVisitAction from "./DashboardLinkVisitAction.svelte";
import LinksTabPinButton from "./LinksTabPinButton.svelte";

export let links: DashboardOverviewLinkItem[];
export let linkIconLabel: (icon: string) => string;
export let linkReturnTo: string;
export let pinAction: (
  link: DashboardOverviewLinkItem,
) => DashboardLinkPinAction;
export let pinLabel: (link: DashboardOverviewLinkItem) => string;
export let submitDashboardLinkPin: DashboardLinkPinSubmit;
export let updatingDashboardLinkSlug: string | null;
</script>

<Table.Root>
  <Table.Body>
    {#each links as link}
      <Table.Row class="group">
        <Table.Cell class="p-0">
          <div class="relative">
            <DashboardLinkVisitAction
              {link}
              {linkIconLabel}
              reserveActionSpace
              variant="row"
            />
            <div class={`absolute top-1/2 right-2 -translate-y-1/2 opacity-100 transition-opacity ${link.isPinned ? "" : "md:pointer-events-none md:opacity-0 md:group-focus-within:pointer-events-auto md:group-focus-within:opacity-100 md:group-hover:pointer-events-auto md:group-hover:opacity-100"}`}>
              <LinksTabPinButton
                {link}
                {linkReturnTo}
                {pinAction}
                {pinLabel}
                {submitDashboardLinkPin}
                {updatingDashboardLinkSlug}
              />
            </div>
          </div>
        </Table.Cell>
      </Table.Row>
    {/each}
  </Table.Body>
</Table.Root>
