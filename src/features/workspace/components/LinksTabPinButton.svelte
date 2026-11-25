<script lang="ts">
export let readOnlyReason: string | undefined = undefined;

import Pin from "@lucide/svelte/icons/pin";
import TableIconButton from "#lib/components/TableIconButton.svelte";
import type {
  WorkspaceCopy,
  WorkspaceLinkPinAction,
  WorkspaceLinkPinSubmit,
  WorkspaceOverviewLinkItem,
} from "@/features/workspace/lib/workspace-controller-helpers";

export let link: WorkspaceOverviewLinkItem;
export let linkReturnTo: string;
export let workspaceCopy: Pick<WorkspaceCopy, "linkHub">;
export let submitWorkspaceLinkPin: WorkspaceLinkPinSubmit;
export let updatingCatalogLinkSlug: string | null;
let action: WorkspaceLinkPinAction;
$: action = link.isPinned ? "unpin" : "pin";
</script>

<form
  action="/api/workspace/link-pins"
  method="POST"
  onsubmit={(event) => {
    event.preventDefault();
    if (readOnlyReason) return;
    void submitWorkspaceLinkPin(link.slug, action);
  }}
>
  <input name="slug" type="hidden" value={link.slug} />
  <input name="returnTo" type="hidden" value={linkReturnTo} />
  <input name="action" type="hidden" value={action} />
  <TableIconButton
    label={workspaceCopy.linkHub[action]}
    disabled={Boolean(readOnlyReason) || updatingCatalogLinkSlug === link.slug}
    title={readOnlyReason}
    type="submit"
    variant={link.isPinned ? "secondary" : "outline"}
  >
    <Pin data-icon="inline-start" />
  </TableIconButton>
</form>
