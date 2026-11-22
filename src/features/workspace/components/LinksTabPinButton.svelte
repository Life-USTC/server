<script lang="ts">
export let readOnlyReason: string | undefined = undefined;

import Pin from "@lucide/svelte/icons/pin";
import TableIconButton from "#lib/components/TableIconButton.svelte";
import type {
  WorkspaceLinkPinAction,
  WorkspaceLinkPinSubmit,
  WorkspaceOverviewLinkItem,
} from "@/features/workspace/lib/workspace-controller-helpers";

export let link: WorkspaceOverviewLinkItem;
export let linkReturnTo: string;
export let pinAction: (
  link: WorkspaceOverviewLinkItem,
) => WorkspaceLinkPinAction;
export let pinLabel: (link: WorkspaceOverviewLinkItem) => string;
export let submitWorkspaceLinkPin: WorkspaceLinkPinSubmit;
export let updatingCatalogLinkSlug: string | null;
</script>

<form
  action="/api/workspace/link-pins"
  method="POST"
  onsubmit={(event) => {
    event.preventDefault();
    if (readOnlyReason) return;
    void submitWorkspaceLinkPin(link.slug, pinAction(link));
  }}
>
  <input name="slug" type="hidden" value={link.slug} />
  <input name="returnTo" type="hidden" value={linkReturnTo} />
  <input name="action" type="hidden" value={pinAction(link)} />
  <TableIconButton
    label={pinLabel(link)}
    disabled={Boolean(readOnlyReason) || updatingCatalogLinkSlug === link.slug}
    title={readOnlyReason}
    type="submit"
    variant={link.isPinned ? "secondary" : "outline"}
  >
    <Pin data-icon="inline-start" />
  </TableIconButton>
</form>
