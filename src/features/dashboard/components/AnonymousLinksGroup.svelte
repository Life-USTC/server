<script lang="ts">
import type {
  AnonymousLinkGroup,
  LinkView,
} from "@/features/dashboard/lib/dashboard-controller-helpers";
import * as Table from "$lib/components/ui/table/index.js";

export let entry: AnonymousLinkGroup;
export let linkIconLabel: (icon: string) => string;
export let linkView: LinkView;
</script>

<section class="grid gap-2">
  <h3 class="font-medium text-base-content/60 text-sm">
    {entry.label}
  </h3>
  {#if linkView === "grid"}
    <div class="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
      {#each entry.links as link}
        <div class="group relative min-w-0 overflow-hidden rounded-md border border-base-300 bg-base-100 transition hover:border-primary hover:bg-base-200/50">
          <form
            action="/api/dashboard-links/visit"
            method="POST"
            rel="noopener"
            target="_blank"
          >
            <input name="slug" type="hidden" value={link.slug} />
            <button
              class="flex min-h-20 w-full items-start gap-3 px-3 py-3 text-left"
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
        </div>
      {/each}
    </div>
  {:else}
    <Table.Root>
      <Table.Body>
        {#each entry.links as link}
          <Table.Row>
            <Table.Cell class="p-0">
              <form
                action="/api/dashboard-links/visit"
                method="POST"
                rel="noopener"
                target="_blank"
              >
                <input name="slug" type="hidden" value={link.slug} />
                <button
                  class="flex min-h-14 w-full items-center gap-3 px-3 py-2 text-left"
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
            </Table.Cell>
          </Table.Row>
        {/each}
      </Table.Body>
    </Table.Root>
  {/if}
</section>
