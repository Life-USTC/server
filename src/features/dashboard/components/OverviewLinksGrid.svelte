<script lang="ts">
import type {
  DashboardDashboardCopy,
  DashboardOverviewLinkItem,
} from "@/features/dashboard/lib/dashboard-controller-helpers";
import Pin from "$lib/components/icons/pin.svelte";
import { Alert } from "$lib/components/ui/alert/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import type { DashboardCalendarTabHref } from "./dashboard-calendar-component-types";

export let dashboardCopy: DashboardDashboardCopy;
export let dashboardTabHref: DashboardCalendarTabHref;
export let linkIconLabel: (icon: string) => string;
export let links: DashboardOverviewLinkItem[];
export let submitDashboardLinkPin: (
  slug: string,
  action: "pin" | "unpin",
) => void;
export let updatingDashboardLinkSlug: string | null;
</script>

<div class="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
  {#each links.slice(0, 4) as link}
    <div class="group relative min-w-0 overflow-hidden rounded-md border border-base-300 bg-base-100 transition hover:border-primary hover:bg-base-200/40">
      <form action="/api/dashboard-links/visit" method="POST" rel="noopener" target="_blank">
        <input name="slug" type="hidden" value={link.slug} />
        <button
          class="flex min-h-20 w-full items-start gap-3 px-3 py-3 pr-16 text-left"
          type="submit"
        >
          <span
            class="inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-base-300 bg-base-200 font-semibold text-[0.6875rem] text-primary"
            aria-hidden="true"
          >
            {linkIconLabel(link.icon)}
          </span>
          <div class="min-w-0 space-y-1">
            <div class="line-clamp-2 font-semibold">{link.title}</div>
            <p class="line-clamp-2 text-base-content/60 text-sm">
              {link.description}
            </p>
          </div>
        </button>
      </form>
      <form
        action="/api/dashboard-links/pin"
        class={`absolute top-2 right-2 opacity-100 transition-opacity ${link.isPinned ? "" : "md:pointer-events-none md:opacity-0 md:group-focus-within:pointer-events-auto md:group-focus-within:opacity-100 md:group-hover:pointer-events-auto md:group-hover:opacity-100"}`}
        method="POST"
        onsubmit={(event) => {
          event.preventDefault();
          submitDashboardLinkPin(link.slug, link.isPinned ? "unpin" : "pin");
        }}
      >
        <input name="slug" type="hidden" value={link.slug} />
        <input name="returnTo" type="hidden" value={dashboardTabHref("overview")} />
        <input name="action" type="hidden" value={link.isPinned ? "unpin" : "pin"} />
        <Button
          aria-label={link.isPinned
            ? dashboardCopy.linkHub.unpin
            : dashboardCopy.linkHub.pin}
          class={link.isPinned
            ? "border-primary bg-primary/10 text-primary hover:bg-primary/15"
            : "bg-base-100/90"}
          disabled={updatingDashboardLinkSlug === link.slug}
          size="icon-sm"
          title={link.isPinned
            ? dashboardCopy.linkHub.unpin
            : dashboardCopy.linkHub.pin}
          type="submit"
          variant="outline"
        >
          <Pin class={link.isPinned ? "fill-primary/20" : ""} />
        </Button>
      </form>
    </div>
  {:else}
    <Alert>{dashboardCopy.linkHub.empty}</Alert>
  {/each}
</div>
