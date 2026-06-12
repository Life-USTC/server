<script lang="ts">
import type {
  DashboardLinkPinAction,
  DashboardLinkPinSubmit,
  DashboardOverviewLinkItem,
} from "@/features/dashboard/lib/dashboard-controller-helpers";
import Pin from "$lib/components/icons/pin.svelte";
import { Button } from "$lib/components/ui/button/index.js";

export let link: DashboardOverviewLinkItem;
export let linkReturnTo: string;
export let pinAction: (
  link: DashboardOverviewLinkItem,
) => DashboardLinkPinAction;
export let pinLabel: (link: DashboardOverviewLinkItem) => string;
export let submitDashboardLinkPin: DashboardLinkPinSubmit;
export let updatingDashboardLinkSlug: string | null;
</script>

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
  <Button
    aria-label={pinLabel(link)}
    class={link.isPinned
      ? "border-primary bg-primary/10 text-primary hover:bg-primary/15"
      : "bg-base-100/90"}
    disabled={updatingDashboardLinkSlug === link.slug}
    size="icon-sm"
    title={pinLabel(link)}
    type="submit"
    variant="outline"
  >
    <Pin class={link.isPinned ? "fill-primary/20" : ""} />
  </Button>
</form>
