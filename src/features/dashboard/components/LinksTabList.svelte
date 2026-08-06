<script lang="ts">
import type {
  DashboardLinkPinAction,
  DashboardLinkPinSubmit,
  DashboardOverviewLinkItem,
} from "@/features/dashboard/lib/dashboard-controller-helpers";
import {
  LINK_TABLE_ACTIONS_COL,
  LINK_TABLE_CLASS,
  LINK_TABLE_NAME_COL,
} from "@/features/dashboard/lib/link-table-layout";
import TruncatedText from "$lib/components/TruncatedText.svelte";
import * as Table from "$lib/components/ui/table/index.js";
import DashboardLinkTableCell from "./DashboardLinkTableCell.svelte";
import LinksTabPinButton from "./LinksTabPinButton.svelte";

export let colActions: string;
export let colDescription: string;
export let colName: string;
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

<div class="relative w-full overflow-x-auto">
  <Table.Root class={LINK_TABLE_CLASS}>
    <colgroup>
      <col class={LINK_TABLE_NAME_COL} />
      <col />
      <col class={LINK_TABLE_ACTIONS_COL} />
    </colgroup>
    <Table.Header>
      <Table.Row>
        <Table.Head>{colName}</Table.Head>
        <Table.Head>{colDescription}</Table.Head>
        <Table.Head>{colActions}</Table.Head>
      </Table.Row>
    </Table.Header>
    <Table.Body>
      {#each links as link}
        <Table.Row class="group">
          <Table.Cell class="p-0">
            <DashboardLinkTableCell {link}>
              <span class="flex min-w-0 items-center gap-2">
                <span
                  aria-hidden="true"
                  class="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-xs"
                >
                  {linkIconLabel(link.icon)}
                </span>
                <TruncatedText text={link.title} />
              </span>
            </DashboardLinkTableCell>
          </Table.Cell>
          <Table.Cell class="p-0">
            <DashboardLinkTableCell {link}>
              <TruncatedText text={link.description} />
            </DashboardLinkTableCell>
          </Table.Cell>
          <Table.Cell class="p-0">
            <div
              class={`flex h-full min-h-12 items-center justify-start px-3 ${link.isPinned ? "" : "md:opacity-0 md:transition-opacity md:group-focus-within:opacity-100 md:group-hover:opacity-100"}`}
            >
              <LinksTabPinButton
                {link}
                {linkReturnTo}
                {pinAction}
                {pinLabel}
                {submitDashboardLinkPin}
                {updatingDashboardLinkSlug}
              />
            </div>
          </Table.Cell>
        </Table.Row>
      {/each}
    </Table.Body>
  </Table.Root>
</div>
