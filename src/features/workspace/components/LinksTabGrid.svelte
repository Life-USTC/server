<script lang="ts">
import type {
  WorkspaceLinkPinAction,
  WorkspaceLinkPinSubmit,
  WorkspaceOverviewLinkItem,
} from "@/features/workspace/lib/workspace-controller-helpers";
import CatalogLinkVisitAction from "./CatalogLinkVisitAction.svelte";
import LinksTabPinButton from "./LinksTabPinButton.svelte";

export let links: WorkspaceOverviewLinkItem[];
export let linkIconLabel: (icon: string) => string;
export let linkReturnTo: string;
export let pinAction: (
  link: WorkspaceOverviewLinkItem,
) => WorkspaceLinkPinAction;
export let pinLabel: (link: WorkspaceOverviewLinkItem) => string;
export let submitWorkspaceLinkPin: WorkspaceLinkPinSubmit;
export let updatingCatalogLinkSlug: string | null;
</script>

<div class="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
  {#each links as link}
    <div class="group relative min-w-0">
      <CatalogLinkVisitAction {link} {linkIconLabel} reserveActionSpace />
      <div class={`absolute top-2 right-2 opacity-100 transition-opacity ${link.isPinned ? "" : "md:pointer-events-none md:opacity-0 md:group-focus-within:pointer-events-auto md:group-focus-within:opacity-100 md:group-hover:pointer-events-auto md:group-hover:opacity-100"}`}>
        <LinksTabPinButton
          {link}
          {linkReturnTo}
          {pinAction}
          {pinLabel}
          {submitWorkspaceLinkPin}
          {updatingCatalogLinkSlug}
        />
      </div>
    </div>
  {/each}
</div>
