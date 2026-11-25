<script lang="ts">
export let readOnlyReason: string | undefined = undefined;
export let personal = true;
export let revealRequest = 0;

import ResponsiveCollection from "#lib/components/ResponsiveCollection.svelte";
import SearchField from "#lib/components/SearchField.svelte";
import TableFieldFilter from "#lib/components/TableFieldFilter.svelte";
import * as Alert from "#lib/components/ui/alert/index.js";
import { Button } from "#lib/components/ui/button/index.js";
import {
  linkGroupColumnsClass,
  linkGroupSectionClass,
} from "@/features/workspace/lib/link-table-layout";
import type {
  CatalogLinkGroupEntry,
  WorkspaceCopy,
  WorkspaceLinkPinSubmit,
  WorkspaceOverviewLinkItem,
} from "@/features/workspace/lib/workspace-controller-helpers";
import { getWorkspacePageCopy } from "@/lib/shell/page-copy";
import { page } from "$app/state";
import { filterLinkGroups, linkTableFields } from "../lib/link-table-filters";
import CatalogLinkVisitAction from "./CatalogLinkVisitAction.svelte";
import LinksTabList from "./LinksTabList.svelte";
import LinksTabPinButton from "./LinksTabPinButton.svelte";
import WorkspaceEmptyState from "./WorkspaceEmptyState.svelte";

export let workspaceCopy: WorkspaceCopy;
export let submitWorkspaceLinkPin: WorkspaceLinkPinSubmit;
export let linkIconLabel: (icon: string) => string;

export let linkSearchQuery: string;
export let linkReturnTo: string;
export let linkActionError: string;
export let updatingCatalogLinkSlug: string | null;
export let groups: CatalogLinkGroupEntry[];
let draft: Record<string, string> = { search: linkSearchQuery };
let applied: Record<string, string> = {};
$: if (revealRequest) {
  draft = {};
  applied = {};
  linkSearchQuery = "";
}
$: common = getWorkspacePageCopy(
  page.data.locale === "en-us" ? "en-us" : "zh-cn",
).common;
$: filterFields = linkTableFields(
  workspaceCopy.linkHub,
  common.tableFilters,
  personal,
);
$: filteredGroups = filterLinkGroups(
  groups,
  [...filterFields.columns, ...filterFields.extras],
  applied,
);
function change(patch: Record<string, string>) {
  draft = { ...draft, ...patch };
}
function apply(event: SubmitEvent) {
  event.preventDefault();
  applied = { ...draft };
  linkSearchQuery = draft.search ?? "";
}
</script>

{#snippet searchField(id: string)}
  <SearchField
    {id}
    form="links-filters"
    label={workspaceCopy.linkHub.searchPlaceholder}
    placeholder={workspaceCopy.linkHub.searchPlaceholder}
    value={draft.search ?? ""}
    oninput={(event) => change({ search: event.currentTarget.value })}
  />
{/snippet}

{#snippet pin(link: WorkspaceOverviewLinkItem)}
  <LinksTabPinButton
    {link}
    {readOnlyReason}
    {linkReturnTo}
    {workspaceCopy}
    {submitWorkspaceLinkPin}
    {updatingCatalogLinkSlug}
  />
{/snippet}

<section class="grid gap-4">
  <form id="links-filters" onsubmit={apply} class="flex flex-wrap items-end gap-3">
    {#each filterFields.extras as field}<TableFieldFilter label={field.label} fields={[field]} values={draft} onchange={change} labels={common.tableFilters} idPrefix={`links-extra-${field.name}`} formId="links-filters" />{/each}
    <Button type="submit">{common.applyFilters}</Button>
  </form>
  <ResponsiveCollection workspace={personal}>
    {#snippet mobile()}
      <div class="mb-3 flex flex-wrap items-center gap-2" data-slot="collection-header">
        {@render searchField("catalog-link-search-mobile")}
        {#each filterFields.columns as field}<TableFieldFilter label={field.label} fields={[field]} values={draft} onchange={change} labels={common.tableFilters} idPrefix={`links-mobile-${field.name}`} formId="links-filters" />{/each}
      </div>
      <div class={linkGroupColumnsClass}>
        {#each filteredGroups as entry}
          <section class={linkGroupSectionClass}>
            <h3 class="font-medium text-muted-foreground text-sm">{entry.label}</h3>
            <div class="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              {#each entry.links as link}
                {#if personal}
                  <div class="group relative min-w-0" data-catalog-link-slug={link.slug} tabindex="-1">
                    <CatalogLinkVisitAction visitCountLabel={readOnlyReason ? workspaceCopy.linkHub.filterVisits : undefined} {readOnlyReason} {link} {linkIconLabel} reserveActionSpace />
                    <div class={`absolute top-2 right-2 opacity-100 transition-opacity ${link.isPinned || readOnlyReason ? "" : "md:pointer-events-none md:opacity-0 md:group-focus-within:pointer-events-auto md:group-focus-within:opacity-100 md:group-hover:pointer-events-auto md:group-hover:opacity-100"}`}>
                      {@render pin(link)}
                    </div>
                  </div>
                {:else}
                  <CatalogLinkVisitAction {link} {linkIconLabel} />
                {/if}
              {/each}
            </div>
          </section>
        {:else}
          <WorkspaceEmptyState
            className="items-start text-left"
            headerClassName="items-start text-left"
            title={workspaceCopy.linkHub.empty}
          />
        {/each}
      </div>
    {/snippet}
    {#snippet desktop()}
      <LinksTabList
        visitCountLabel={readOnlyReason ? workspaceCopy.linkHub.filterVisits : undefined}
        {readOnlyReason}
        colName={workspaceCopy.linkHub.colName}
        colDescription={workspaceCopy.linkHub.colDescription}
        colActions={workspaceCopy.linkHub.colActions}
        emptyLabel={workspaceCopy.linkHub.empty}
        actions={personal ? pin : undefined}
        groups={filteredGroups}
        fields={filterFields.columns}
        values={draft}
        onchange={change}
        filterLabels={common.tableFilters}
        {linkIconLabel}
      >
        {#snippet searchControls()}
          {@render searchField("catalog-link-search-desktop")}
        {/snippet}
      </LinksTabList>
    {/snippet}
  </ResponsiveCollection>

  {#if personal && linkActionError}
    <Alert.Root variant="destructive">
      <Alert.Description
        >{workspaceCopy.linkHub.pinFailedTitle}: {linkActionError}</Alert.Description
      >
    </Alert.Root>
  {/if}

  <p class="text-muted-foreground text-xs">
    {workspaceCopy.linkHub.credit}
    <Button
      class="h-auto p-0"
      href={readOnlyReason ? undefined : "https://github.com/SmartHypercube/ustclife"}
      disabled={Boolean(readOnlyReason)}
      title={readOnlyReason}
      rel="noreferrer"
      target="_blank"
      variant="link"
    >
      SmartHypercube/ustclife
    </Button>{workspaceCopy.linkHub.creditSuffix}
  </p>
</section>
