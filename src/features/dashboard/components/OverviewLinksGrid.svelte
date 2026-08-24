<script lang="ts">
import type {
  DashboardDashboardCopy,
  DashboardLinkPinAction,
  DashboardOverviewLinkItem,
} from "@/features/dashboard/lib/dashboard-controller-helpers";
import { DASHBOARD_OVERVIEW_PREVIEW_LIMIT } from "@/features/dashboard/lib/overview-preview";
import { dashboardLinkVisitHref } from "@/features/dashboard-links/lib/dashboard-links";
import * as Empty from "$lib/components/ui/empty/index.js";
import type { DashboardCalendarTabHref } from "./dashboard-calendar-component-types";
import LinksTabPinButton from "./LinksTabPinButton.svelte";
import OverviewSection from "./OverviewSection.svelte";

export let dashboardCopy: DashboardDashboardCopy;
export let dashboardTabHref: DashboardCalendarTabHref;
export let linkIconLabel: (icon: string) => string;
export let links: DashboardOverviewLinkItem[];
export let submitDashboardLinkPin: (
  slug: string,
  action: "pin" | "unpin",
) => void;
export let updatingDashboardLinkSlug: string | null;

const previewLimit = DASHBOARD_OVERVIEW_PREVIEW_LIMIT;
$: previewLinks = links.slice(0, previewLimit);

function pinLabel(link: DashboardOverviewLinkItem) {
  return link.isPinned
    ? dashboardCopy.linkHub.unpin
    : dashboardCopy.linkHub.pin;
}

function pinAction(link: DashboardOverviewLinkItem): DashboardLinkPinAction {
  return link.isPinned ? "unpin" : "pin";
}
</script>

<OverviewSection
  href="/catalog/links"
  testId="dashboard-overview-links"
  title={dashboardCopy.linkHub.title}
  viewAllHref="/catalog/links"
  viewAllLabel={dashboardCopy.viewAll as string}
  viewAllVisible={links.length > previewLimit}
>
  {#if previewLinks.length > 0}
    <div class="grid min-w-0 gap-1 sm:grid-cols-2 xl:grid-cols-4">
      {#each previewLinks as link}
        <div class="group relative min-w-0">
          <a
            class="flex w-full min-w-0 items-start gap-3 rounded-lg px-2 py-2.5 text-left transition-colors hover:bg-muted/50"
            class:pe-10={true}
            href={dashboardLinkVisitHref(link.slug)}
            rel="noopener noreferrer"
            target="_blank"
          >
            <span
              aria-hidden="true"
              class="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-medium"
            >
              {linkIconLabel(link.icon)}
            </span>
            <span class="grid min-w-0 gap-0.5">
              <span class="truncate font-medium text-sm">{link.title}</span>
              <span class="line-clamp-2 text-muted-foreground text-xs"
                >{link.description}</span
              >
            </span>
          </a>
          <div
            class={`absolute top-2 right-1 ${link.isPinned ? "" : "md:pointer-events-none md:opacity-0 md:transition-opacity md:group-focus-within:pointer-events-auto md:group-focus-within:opacity-100 md:group-hover:pointer-events-auto md:group-hover:opacity-100"}`}
          >
            <LinksTabPinButton
              {link}
              linkReturnTo={dashboardTabHref("overview")}
              {pinAction}
              {pinLabel}
              {submitDashboardLinkPin}
              {updatingDashboardLinkSlug}
            />
          </div>
        </div>
      {/each}
    </div>
  {:else}
    <Empty.Root class="min-h-20 border-0 px-2 py-6">
      <Empty.Header>
        <Empty.Description>{dashboardCopy.linkHub.empty}</Empty.Description>
      </Empty.Header>
    </Empty.Root>
  {/if}
</OverviewSection>
