<script lang="ts">
import ResponsiveCollection from "#lib/components/ResponsiveCollection.svelte";
import { Button } from "#lib/components/ui/button/index.js";
import { linkGroupColumnsClass } from "@/features/workspace/lib/link-table-layout";
import type {
  AnonymousLinkGroup,
  WorkspaceCopy,
} from "@/features/workspace/lib/workspace-controller-helpers";
import AnonymousLinksGroup from "./AnonymousLinksGroup.svelte";
import LinksTabList from "./LinksTabList.svelte";
import LinksTabToolbar from "./LinksTabToolbar.svelte";
import WorkspaceEmptyState from "./WorkspaceEmptyState.svelte";

export let workspaceCopy: Pick<WorkspaceCopy, "linkHub">;
export let linkIconLabel: (icon: string) => string;

export let linkSearchQuery: string;
export let anonymousLinkGroups: AnonymousLinkGroup[];
</script>

<section class="grid gap-4">
  <ResponsiveCollection>
    {#snippet mobile()}
      <div class="mb-3 flex flex-wrap items-center gap-2" data-slot="collection-header">
        <LinksTabToolbar id="catalog-link-search-mobile" {workspaceCopy} bind:linkSearchQuery />
      </div>
  <div class={linkGroupColumnsClass}>
    {#each anonymousLinkGroups as entry}
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
        groups={anonymousLinkGroups}
        {linkIconLabel}
      >
        {#snippet searchControls()}
          <LinksTabToolbar id="catalog-link-search-desktop" {workspaceCopy} bind:linkSearchQuery />
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
