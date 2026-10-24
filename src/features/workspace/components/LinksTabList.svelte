<script lang="ts">
import type { Snippet } from "svelte";
import TableControlsRow from "#lib/components/TableControlsRow.svelte";
import TableFieldFilter from "#lib/components/TableFieldFilter.svelte";
import TruncatedText from "#lib/components/TruncatedText.svelte";
import * as Table from "#lib/components/ui/table/index.js";
import { cn } from "#lib/utils.js";
import {
  LINK_TABLE_ACTIONS_COL,
  LINK_TABLE_CLASS,
  LINK_TABLE_NAME_COL,
} from "@/features/workspace/lib/link-table-layout";
import type {
  AnonymousLinkGroup,
  WorkspaceOverviewLinkItem,
} from "@/features/workspace/lib/workspace-controller-helpers";
import type { TableFilterField, TableFilterLabels } from "@/lib/table-filters";
import CatalogLinkTableCell from "./CatalogLinkTableCell.svelte";
import WorkspaceEmptyState from "./WorkspaceEmptyState.svelte";

export let colActions: string = "";
export let colDescription: string;
export let colName: string;
export let emptyLabel: string;
export let groups: AnonymousLinkGroup[];
export let linkIconLabel: (icon: string) => string;
export let searchControls: Snippet;
export let fields: TableFilterField[];
export let values: Record<string, string>;
export let onchange: (patch: Record<string, string>) => void;
export let filterLabels: TableFilterLabels;
export let actions: Snippet<[WorkspaceOverviewLinkItem]> | undefined =
  undefined;
</script>

<div class="relative w-full overflow-x-auto">
  <Table.Root class={LINK_TABLE_CLASS}>
    <colgroup>
      <col class={LINK_TABLE_NAME_COL} />
      <col />
      {#if actions}<col class={LINK_TABLE_ACTIONS_COL} />{/if}
    </colgroup>
    <Table.Header>
      <TableControlsRow colspan={actions ? 3 : 2}>{@render searchControls()}</TableControlsRow>
      <Table.Row>
        <Table.Head><TableFieldFilter label={colName} fields={[fields[0]]} {values} {onchange} labels={filterLabels} idPrefix="links-desktop-name" formId="links-filters" /></Table.Head>
        <Table.Head><TableFieldFilter label={colDescription} fields={[fields[1]]} {values} {onchange} labels={filterLabels} idPrefix="links-desktop-description" formId="links-filters" /></Table.Head>
        {#if actions}<Table.Head>{colActions}</Table.Head>{/if}
      </Table.Row>
    </Table.Header>
    {#each groups as entry}
    <Table.Body>
      <Table.Row><Table.Head scope="rowgroup" colspan={actions ? 3 : 2}>{entry.label}</Table.Head></Table.Row>
      {#each entry.links as link}
        <Table.Row class="group">
          <Table.Cell class="p-0">
            <CatalogLinkTableCell {link}>
              <span class="flex min-w-0 items-center gap-2">
                <span
                  aria-hidden="true"
                  class="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-xs"
                >
                  {linkIconLabel(link.icon)}
                </span>
                <TruncatedText class="font-medium" text={link.title} />
              </span>
            </CatalogLinkTableCell>
          </Table.Cell>
          <Table.Cell class="p-0">
            <CatalogLinkTableCell {link}>
              <TruncatedText class="text-muted-foreground" text={link.description} />
            </CatalogLinkTableCell>
          </Table.Cell>
          {#if actions}
            <Table.Cell class="p-0">
              <div class={cn(
                "flex h-full min-h-12 items-center justify-start px-3",
                !link.isPinned && "md:opacity-0 md:transition-opacity md:group-focus-within:opacity-100 md:group-hover:opacity-100",
              )}>{@render actions(link)}</div>
            </Table.Cell>
          {/if}
        </Table.Row>
      {/each}
    </Table.Body>
    {:else}
      <Table.Body><Table.Row><Table.Cell colspan={actions ? 3 : 2}>
        <WorkspaceEmptyState title={emptyLabel} />
      </Table.Cell></Table.Row></Table.Body>
    {/each}
  </Table.Root>
</div>
