<script lang="ts">
export let visitCountLabel: string | undefined = undefined;
export let readOnlyReason: string | undefined = undefined;

import type { Snippet } from "svelte";
import EmptyState from "#lib/components/EmptyState.svelte";
import TableControlsRow from "#lib/components/TableControlsRow.svelte";
import TableFieldFilter from "#lib/components/TableFieldFilter.svelte";
import TruncatedText from "#lib/components/TruncatedText.svelte";
import Table from "#lib/components/ui/table/table.svelte";
import { cn } from "#lib/utils.js";
import {
  LINK_TABLE_ACTIONS_COL,
  LINK_TABLE_CLASS,
  LINK_TABLE_NAME_COL,
} from "@/features/workspace/lib/link-table-layout";
import type {
  CatalogLinkGroupEntry,
  WorkspaceOverviewLinkItem,
} from "@/features/workspace/lib/workspace-controller-helpers";
import type { TableFilterField, TableFilterLabels } from "@/lib/table-filters";
import CatalogLinkTableCell from "./CatalogLinkTableCell.svelte";

export let colActions: string = "";
export let colDescription: string;
export let colName: string;
export let emptyLabel: string;
export let groups: CatalogLinkGroupEntry[];
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
  <Table class={LINK_TABLE_CLASS}>
    <colgroup>
      <col class={LINK_TABLE_NAME_COL} />
      <col />
      {#if actions}<col class={LINK_TABLE_ACTIONS_COL} />{/if}
    </colgroup>
    <thead>
      <TableControlsRow colspan={actions ? 3 : 2}>{@render searchControls()}</TableControlsRow>
      <tr>
        <th><TableFieldFilter label={colName} fields={[fields[0]]} {values} {onchange} labels={filterLabels} idPrefix="links-desktop-name" formId="links-filters" /></th>
        <th><TableFieldFilter label={colDescription} fields={[fields[1]]} {values} {onchange} labels={filterLabels} idPrefix="links-desktop-description" formId="links-filters" /></th>
        {#if actions}<th>{colActions}</th>{/if}
      </tr>
    </thead>
    {#each groups as entry}
    <tbody>
      <tr><th scope="rowgroup" colspan={actions ? 3 : 2}>{entry.label}</th></tr>
      {#each entry.links as link}
        <tr class="group" data-catalog-link-slug={link.slug} tabindex={-1}>
          <td class="p-0">
            <CatalogLinkTableCell {visitCountLabel} {readOnlyReason} {link}>
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
          </td>
          <td class="p-0">
            <CatalogLinkTableCell {readOnlyReason} {link}>
              <TruncatedText class="text-muted-foreground" text={link.description} />
            </CatalogLinkTableCell>
          </td>
          {#if actions}
            <td class="p-0">
              <div class={cn(
                "flex h-full min-h-12 items-center justify-start px-(--table-cell-inset)",
                !link.isPinned && !readOnlyReason && "md:opacity-0 md:transition-opacity md:group-focus-within:opacity-100 md:group-hover:opacity-100",
              )}>{@render actions(link)}</div>
            </td>
          {/if}
        </tr>
      {/each}
    </tbody>
    {:else}
      <tbody><tr><td colspan={actions ? 3 : 2}>
        <EmptyState title={emptyLabel} />
      </td></tr></tbody>
    {/each}
  </Table>
</div>
