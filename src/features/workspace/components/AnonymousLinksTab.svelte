<script lang="ts">
import ResponsiveCollection from "#lib/components/ResponsiveCollection.svelte";
import TableFieldFilter from "#lib/components/TableFieldFilter.svelte";
import { Button } from "#lib/components/ui/button/index.js";
import { linkGroupColumnsClass } from "@/features/workspace/lib/link-table-layout";
import type {
  AnonymousLinkGroup,
  WorkspaceCopy,
} from "@/features/workspace/lib/workspace-controller-helpers";
import { getWorkspacePageCopy } from "@/lib/shell/page-copy";
import { page } from "$app/state";
import { filterLinkGroups, linkTableFields } from "../lib/link-table-filters";
import AnonymousLinksGroup from "./AnonymousLinksGroup.svelte";
import LinksTabList from "./LinksTabList.svelte";
import LinksTabToolbar from "./LinksTabToolbar.svelte";
import WorkspaceEmptyState from "./WorkspaceEmptyState.svelte";

export let workspaceCopy: Pick<WorkspaceCopy, "linkHub">;
export let linkIconLabel: (icon: string) => string;

export let linkSearchQuery: string;
export let anonymousLinkGroups: AnonymousLinkGroup[];
let draft: Record<string, string> = { search: linkSearchQuery };
let applied: Record<string, string> = {};
$: common = getWorkspacePageCopy(
  page.data.locale === "en-us" ? "en-us" : "zh-cn",
).common;
$: filterFields = linkTableFields(
  workspaceCopy.linkHub,
  common.tableFilters,
  false,
);
$: filteredGroups = filterLinkGroups(
  anonymousLinkGroups,
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

<section class="grid gap-4">
  <form id="links-filters" onsubmit={apply} class="flex flex-wrap items-end gap-3">
    {#each filterFields.extras as field}<TableFieldFilter label={field.label} fields={[field]} values={draft} onchange={change} labels={common.tableFilters} idPrefix={`links-extra-${field.name}`} formId="links-filters" />{/each}
    <Button type="submit">{common.applyFilters}</Button>
  </form>
  <ResponsiveCollection>
    {#snippet mobile()}
      <div class="mb-3 flex flex-wrap items-center gap-2" data-slot="collection-header">
        <LinksTabToolbar id="catalog-link-search-mobile" {workspaceCopy} linkSearchQuery={draft.search ?? ""} onchange={(search) => change({ search })} />
        {#each filterFields.columns as field}<TableFieldFilter label={field.label} fields={[field]} values={draft} onchange={change} labels={common.tableFilters} idPrefix={`links-mobile-${field.name}`} formId="links-filters" />{/each}
      </div>
  <div class={linkGroupColumnsClass}>
    {#each filteredGroups as entry}
      <AnonymousLinksGroup
        {entry}
        {linkIconLabel}
      />
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
        colName={workspaceCopy.linkHub.colName}
        colDescription={workspaceCopy.linkHub.colDescription}
        colActions={workspaceCopy.linkHub.colActions}
        emptyLabel={workspaceCopy.linkHub.empty}
        groups={filteredGroups}
        fields={filterFields.columns}
        values={draft}
        onchange={change}
        filterLabels={common.tableFilters}
        {linkIconLabel}
      >
        {#snippet searchControls()}
          <LinksTabToolbar id="catalog-link-search-desktop" {workspaceCopy} linkSearchQuery={draft.search ?? ""} onchange={(search) => change({ search })} />
        {/snippet}
      </LinksTabList>
    {/snippet}
  </ResponsiveCollection>

  <p class="text-muted-foreground text-xs">
    {workspaceCopy.linkHub.credit}
    <Button
      class="h-auto p-0"
      href="https://github.com/SmartHypercube/ustclife"
      rel="noreferrer"
      target="_blank"
      variant="link"
    >
      SmartHypercube/ustclife
    </Button>{workspaceCopy.linkHub.creditSuffix}
  </p>
</section>
