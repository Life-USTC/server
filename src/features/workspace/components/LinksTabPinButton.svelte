<script lang="ts">
import Pin from "@lucide/svelte/icons/pin";
import type {
  WorkspaceLinkPinAction,
  WorkspaceLinkPinSubmit,
  WorkspaceOverviewLinkItem,
} from "@/features/workspace/lib/workspace-controller-helpers";
import { Button } from "$lib/components/ui/button/index.js";
import * as Tooltip from "$lib/components/ui/tooltip/index.js";

export let link: WorkspaceOverviewLinkItem;
export let linkReturnTo: string;
export let pinAction: (
  link: WorkspaceOverviewLinkItem,
) => WorkspaceLinkPinAction;
export let pinLabel: (link: WorkspaceOverviewLinkItem) => string;
export let submitWorkspaceLinkPin: WorkspaceLinkPinSubmit;
export let updatingCatalogLinkSlug: string | null;
</script>

<Tooltip.Root>
  <form
    action="/api/workspace/link-pins"
    method="POST"
    onsubmit={(event) => {
      event.preventDefault();
      void submitWorkspaceLinkPin(link.slug, pinAction(link));
    }}
  >
    <input name="slug" type="hidden" value={link.slug} />
    <input name="returnTo" type="hidden" value={linkReturnTo} />
    <input name="action" type="hidden" value={pinAction(link)} />
    <Tooltip.Trigger>
      {#snippet child({ props })}
        <Button
          {...props}
          aria-label={pinLabel(link)}
          disabled={updatingCatalogLinkSlug === link.slug}
          size="icon-sm"
          type="submit"
          variant={link.isPinned ? "secondary" : "outline"}
        >
          <Pin data-icon="inline-start" />
        </Button>
      {/snippet}
    </Tooltip.Trigger>
  </form>
  <Tooltip.Content>{pinLabel(link)}</Tooltip.Content>
</Tooltip.Root>
