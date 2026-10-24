<script lang="ts">
import { linkGroupSectionClass } from "@/features/workspace/lib/link-table-layout";
import type {
  SignedLinkGroup,
  WorkspaceCopy,
  WorkspaceLinkPinAction,
  WorkspaceLinkPinSubmit,
  WorkspaceOverviewLinkItem,
} from "@/features/workspace/lib/workspace-controller-helpers";
import LinksTabGrid from "./LinksTabGrid.svelte";

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

<section class={linkGroupSectionClass}>
  <h3 class="font-medium text-muted-foreground text-sm">
    {entry.label}
  </h3>
      <LinksTabGrid
        links={entry.links}
        {linkIconLabel}
        {linkReturnTo}
        {pinAction}
        {pinLabel}
        {submitWorkspaceLinkPin}
        {updatingCatalogLinkSlug}
      />
</section>
