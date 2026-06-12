<script lang="ts">
import type {
  DashboardLinkPinAction,
  DashboardLinkPinSubmit,
  DashboardOverviewLinkItem,
} from "@/features/dashboard/lib/dashboard-controller-helpers";
import LinksTabPinButton from "./LinksTabPinButton.svelte";

export let links: DashboardOverviewLinkItem[];
export let linkIconLabel: (icon: string) => string;
export let linkReturnTo: string;
export let pinAction: (
  link: DashboardOverviewLinkItem,
) => DashboardLinkPinAction;
export let pinLabel: (link: DashboardOverviewLinkItem) => string;
export let submitDashboardLinkPin: DashboardLinkPinSubmit;
export let updatingDashboardLinkSlug: string | null;
</script>

<div class="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
  {#each links as link}
    <div class="group relative min-w-0 overflow-hidden rounded-md border border-base-300 bg-base-100 transition hover:border-primary hover:bg-base-200/50">
      <form
        action="/api/dashboard-links/visit"
        method="POST"
        rel="noopener"
        target="_blank"
      >
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
      <div class={`absolute top-2 right-2 opacity-100 transition-opacity ${link.isPinned ? "" : "md:pointer-events-none md:opacity-0 md:group-focus-within:pointer-events-auto md:group-focus-within:opacity-100 md:group-hover:pointer-events-auto md:group-hover:opacity-100"}`}>
        <LinksTabPinButton
          {link}
          {linkReturnTo}
          {pinAction}
          {pinLabel}
          {submitDashboardLinkPin}
          {updatingDashboardLinkSlug}
        />
      </div>
    </div>
  {/each}
</div>
