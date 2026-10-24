<script lang="ts">
import * as Alert from "#lib/components/ui/alert/index.js";
import { Button } from "#lib/components/ui/button/index.js";
import WorkspaceCollection from "#lib/components/WorkspaceCollection.svelte";
import { linkGroupColumnsClass } from "@/features/workspace/lib/link-table-layout";
import type {
  SignedLinkGroup,
  WorkspaceCopy,
  WorkspaceLinkPinSubmit,
  WorkspaceOverviewLinkItem,
} from "@/features/workspace/lib/workspace-controller-helpers";
import LinksTabGroup from "./LinksTabGroup.svelte";
import LinksTabList from "./LinksTabList.svelte";
import LinksTabPinButton from "./LinksTabPinButton.svelte";
import LinksTabToolbar from "./LinksTabToolbar.svelte";
import WorkspaceEmptyState from "./WorkspaceEmptyState.svelte";

export let workspaceCopy: WorkspaceCopy;
export let submitWorkspaceLinkPin: WorkspaceLinkPinSubmit;
export let linkIconLabel: (icon: string) => string;

export let linkSearchQuery: string;
export let linkReturnTo: string;
export let linkActionError: string;
export let updatingCatalogLinkSlug: string | null;
export let signedLinkGroups: SignedLinkGroup[];
</script>

<section class="grid gap-4">
  <WorkspaceCollection>
    {#snippet mobile()}
      <div class="mb-3 flex flex-wrap items-center gap-2" data-slot="collection-header">
        <LinksTabToolbar id="catalog-link-search-mobile" {workspaceCopy} bind:linkSearchQuery />
      </div>
  <div class={linkGroupColumnsClass}>
    {#each signedLinkGroups as entry}
      <LinksTabGroup
        {workspaceCopy}
        {entry}
        {linkIconLabel}
        {linkReturnTo}
        {submitWorkspaceLinkPin}
        {updatingCatalogLinkSlug}
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
        groups={signedLinkGroups}
        {linkIconLabel}
      >
        {#snippet searchControls()}
          <LinksTabToolbar id="catalog-link-search-desktop" {workspaceCopy} bind:linkSearchQuery />
        {/snippet}
        {#snippet actions(link: WorkspaceOverviewLinkItem)}
          <LinksTabPinButton
            {link}
            {linkReturnTo}
            pinAction={(item) => item.isPinned ? "unpin" : "pin"}
            pinLabel={(item) => item.isPinned ? workspaceCopy.linkHub.unpin : workspaceCopy.linkHub.pin}
            {submitWorkspaceLinkPin}
            {updatingCatalogLinkSlug}
          />
        {/snippet}
      </LinksTabList>
    {/snippet}
  </WorkspaceCollection>

  {#if linkActionError}
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
      href="https://github.com/SmartHypercube/ustclife"
      rel="noreferrer"
      target="_blank"
      variant="link"
    >
      SmartHypercube/ustclife
    </Button>{workspaceCopy.linkHub.creditSuffix}
  </p>
</section>
