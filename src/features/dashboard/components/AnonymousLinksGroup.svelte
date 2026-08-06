<script lang="ts">
import type { AnonymousLinkGroup } from "@/features/dashboard/lib/dashboard-controller-helpers";
import {
  LINK_TABLE_CLASS,
  LINK_TABLE_NAME_COL,
} from "@/features/dashboard/lib/link-table-layout";
import TruncatedText from "$lib/components/TruncatedText.svelte";
import * as Table from "$lib/components/ui/table/index.js";
import DashboardLinkTableCell from "./DashboardLinkTableCell.svelte";
import DashboardLinkVisitAction from "./DashboardLinkVisitAction.svelte";

export let colDescription: string;
export let colName: string;
export let entry: AnonymousLinkGroup;
export let linkIconLabel: (icon: string) => string;
</script>

<section class="grid gap-2">
  <h3 class="font-medium text-muted-foreground text-sm">
    {entry.label}
  </h3>
  <div class="grid gap-3 md:grid-cols-2 lg:grid-cols-4 xl:hidden">
    {#each entry.links as link}
      <DashboardLinkVisitAction {link} {linkIconLabel} />
    {/each}
  </div>
  <div class="relative hidden w-full overflow-x-auto xl:block">
    <Table.Root class={LINK_TABLE_CLASS}>
      <colgroup>
        <col class={LINK_TABLE_NAME_COL} />
        <col />
      </colgroup>
      <Table.Header>
        <Table.Row>
          <Table.Head>{colName}</Table.Head>
          <Table.Head>{colDescription}</Table.Head>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {#each entry.links as link}
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
          </Table.Row>
        {/each}
      </Table.Body>
    </Table.Root>
  </div>
</section>
