<script lang="ts">
import type {
  DashboardLinkPinAction,
  DashboardLinkPinSubmit,
  DashboardOverviewLinkItem,
} from "@/features/dashboard/lib/dashboard-controller-helpers";
import * as Table from "$lib/components/ui/table/index.js";
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

<Table.Root>
  <Table.Body>
    {#each links as link}
      <Table.Row class="group">
        <Table.Cell class="p-0">
          <div class="relative">
            <form
              action="/api/dashboard-links/visit"
              method="POST"
              rel="noopener"
              target="_blank"
            >
              <input name="slug" type="hidden" value={link.slug} />
              <button
                class="flex min-h-14 w-full items-center gap-3 px-3 py-2 pr-16 text-left"
                type="submit"
              >
                <span
                  class="inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-base-300 bg-base-200 font-semibold text-[0.6875rem] text-primary"
                  aria-hidden="true"
                >
                  {linkIconLabel(link.icon)}
                </span>
                <div class="min-w-0 sm:grid sm:grid-cols-[minmax(10rem,16rem)_1fr] sm:items-center sm:gap-4">
                  <div class="line-clamp-1 font-semibold">{link.title}</div>
                  <p class="line-clamp-1 text-base-content/60 text-sm">
                    {link.description}
                  </p>
                </div>
              </button>
            </form>
            <div class={`absolute top-1/2 right-2 -translate-y-1/2 opacity-100 transition-opacity ${link.isPinned ? "" : "md:pointer-events-none md:opacity-0 md:group-focus-within:pointer-events-auto md:group-focus-within:opacity-100 md:group-hover:pointer-events-auto md:group-hover:opacity-100"}`}>
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
        </Table.Cell>
      </Table.Row>
    {/each}
  </Table.Body>
</Table.Root>
