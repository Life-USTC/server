<script lang="ts">
import * as Alert from "#lib/components/ui/alert/index.js";
import { Button } from "#lib/components/ui/button/index.js";
import { linkGroupColumnsClass } from "@/features/workspace/lib/link-table-layout";
import type {
  SignedLinkGroup,
  WorkspaceCopy,
  WorkspaceLinkPinSubmit,
} from "@/features/workspace/lib/workspace-controller-helpers";
import LinksTabGroup from "./LinksTabGroup.svelte";
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
  <LinksTabToolbar
    {workspaceCopy}
    bind:linkSearchQuery
  />

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
