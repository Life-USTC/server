<script lang="ts">
import Pin from "@lucide/svelte/icons/pin";
import type {
  DashboardLinkPinAction,
  DashboardLinkPinSubmit,
  DashboardOverviewLinkItem,
} from "@/features/dashboard/lib/dashboard-controller-helpers";
import { Button } from "$lib/components/ui/button/index.js";
import * as Tooltip from "$lib/components/ui/tooltip/index.js";

export let link: DashboardOverviewLinkItem;
export let linkReturnTo: string;
export let pinAction: (
  link: DashboardOverviewLinkItem,
) => DashboardLinkPinAction;
export let pinLabel: (link: DashboardOverviewLinkItem) => string;
export let submitDashboardLinkPin: DashboardLinkPinSubmit;
export let updatingDashboardLinkSlug: string | null;
</script>

<Tooltip.Root>
  <form
    action="/api/dashboard-links/pin"
    method="POST"
    onsubmit={(event) => {
      event.preventDefault();
      void submitDashboardLinkPin(link.slug, pinAction(link));
    }}
  >
    <input name="slug" type="hidden" value={link.slug} />
    <input name="returnTo" type="hidden" value={linkReturnTo} />
    <input name="action" type="hidden" value={pinAction(link)} />
    <Tooltip.Trigger>
      {#snippet child({ props })}
        <Button
          aria-label={pinLabel(link)}
          class={link.isPinned
            ? "border-primary bg-primary/10 text-primary hover:bg-primary/15"
            : "bg-base-100/90"}
          disabled={updatingDashboardLinkSlug === link.slug}
          size="icon-sm"
          type="submit"
          variant="outline"
          {...props}
        >
          <Pin data-icon="inline-start" class={link.isPinned ? "fill-primary/20" : ""} />
        </Button>
      {/snippet}
    </Tooltip.Trigger>
  </form>
  <Tooltip.Content>{pinLabel(link)}</Tooltip.Content>
</Tooltip.Root>
