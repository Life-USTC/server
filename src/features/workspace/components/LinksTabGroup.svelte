<script lang="ts">
import type {
  SignedLinkGroup,
  WorkspaceCopy,
  WorkspaceLinkPinAction,
  WorkspaceLinkPinSubmit,
  WorkspaceOverviewLinkItem,
} from "@/features/workspace/lib/workspace-controller-helpers";
import LinksTabGrid from "./LinksTabGrid.svelte";
import LinksTabList from "./LinksTabList.svelte";

export let workspaceCopy: WorkspaceCopy;
export let entry: SignedLinkGroup;
export let linkIconLabel: (icon: string) => string;
export let linkReturnTo: string;
export let submitWorkspaceLinkPin: WorkspaceLinkPinSubmit;
export let updatingCatalogLinkSlug: string | null;

function pinLabel(link: WorkspaceOverviewLinkItem) {
  return link.isPinned
    ? workspaceCopy.linkHub.unpin
    : workspaceCopy.linkHub.pin;
}

function pinAction(link: WorkspaceOverviewLinkItem): WorkspaceLinkPinAction {
  return link.isPinned ? "unpin" : "pin";
}
</script>

<section class="grid gap-2">
  <h3 class="font-medium text-muted-foreground text-sm">
    {entry.label}
  </h3>
  <div class="xl:hidden">
    <LinksTabGrid
      links={entry.links}
      {linkIconLabel}
      {linkReturnTo}
      {pinAction}
      {pinLabel}
      {submitWorkspaceLinkPin}
      {updatingCatalogLinkSlug}
    />
  </div>
  <div class="hidden xl:block">
    <LinksTabList
      colActions={workspaceCopy.linkHub.colActions}
      colDescription={workspaceCopy.linkHub.colDescription}
      colName={workspaceCopy.linkHub.colName}
      links={entry.links}
      {linkIconLabel}
      {linkReturnTo}
      {pinAction}
      {pinLabel}
      {submitWorkspaceLinkPin}
      {updatingCatalogLinkSlug}
    />
  </div>
</section>
