<script lang="ts">
import type {
  DashboardDashboardCopy,
  DashboardSectionCopy,
  DashboardSubscriptionsCopy,
  SubscriptionsData,
} from "@/features/dashboard/lib/dashboard-controller-types";
import RefreshCw from "$lib/components/icons/refresh-cw.svelte";
import Trash2 from "$lib/components/icons/trash-2.svelte";
import { Button } from "$lib/components/ui/button/index.js";
import * as Table from "$lib/components/ui/table/index.js";

type SubscriptionSection =
  SubscriptionsData["subscriptions"][number]["sections"][number];

export let dashboardCopy: DashboardDashboardCopy;
export let pendingRemoveSectionId: SubscriptionSection["id"] | null;
export let removeSubscribedSection: (
  sectionId: SubscriptionSection["id"],
) => void | Promise<void>;
export let removingSectionId: SubscriptionSection["id"] | null;
export let sectionCopy: DashboardSectionCopy;
export let sections: SubscriptionSection[];
export let subscriptionsCopy: DashboardSubscriptionsCopy;
</script>

<div class="hidden min-w-0 max-w-full overflow-x-auto overscroll-x-contain md:block">
  <Table.Root class="min-w-[32rem] table-fixed">
    <Table.Header>
      <Table.Row>
        <Table.Head class="w-36">{subscriptionsCopy.section}</Table.Head>
        <Table.Head>{subscriptionsCopy.courseName}</Table.Head>
        <Table.Head class="w-24">{sectionCopy.teachers}</Table.Head>
        <Table.Head class="w-12">{subscriptionsCopy.credits}</Table.Head>
        <Table.Head class="w-12 text-right">
          <span class="sr-only">{subscriptionsCopy.rowActions}</span>
        </Table.Head>
      </Table.Row>
    </Table.Header>
    <Table.Body>
      {#each sections as section}
        <Table.Row class="group/section-row">
          <Table.Cell class="max-w-0 p-0">
            <a
              class="block truncate px-3 py-3 font-mono text-base-content text-sm no-underline outline-none transition hover:text-primary hover:underline focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-inset"
              href={`/sections/${section.jwId}`}
            >
              {section.code}
            </a>
          </Table.Cell>
          <Table.Cell class="max-w-0 p-0">
            <a
              class="block truncate px-3 py-3 text-base-content no-underline outline-none transition hover:text-primary hover:underline focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-inset"
              href={`/sections/${section.jwId}`}
            >
              {section.course.namePrimary ?? dashboardCopy.notAvailable}
            </a>
          </Table.Cell>
          <Table.Cell class="max-w-0 p-0">
            <a
              class="block truncate px-3 py-3 text-base-content no-underline outline-none transition hover:text-primary hover:underline focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-inset"
              href={`/sections/${section.jwId}`}
            >
              {section.teachers
                .map((teacher) => teacher.namePrimary)
                .join(", ") || sectionCopy.noTeachersListed}
            </a>
          </Table.Cell>
          <Table.Cell class="max-w-0 p-0">
            <a
              class="block truncate px-3 py-3 text-base-content no-underline outline-none transition hover:text-primary hover:underline focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-inset"
              href={`/sections/${section.jwId}`}
            >
              {section.credits ?? dashboardCopy.notAvailable}
            </a>
          </Table.Cell>
          <Table.Cell class="p-0 text-right">
            <Button
              class={pendingRemoveSectionId === section.id
                ? "m-1 border-error bg-error text-error-content hover:bg-error/90"
                : "m-1 opacity-100 transition-opacity md:opacity-0 md:group-hover/section-row:opacity-100 md:group-focus-within/section-row:opacity-100"}
              disabled={removingSectionId === section.id}
              size="icon-sm"
              type="button"
              variant={pendingRemoveSectionId === section.id
                ? "default"
                : "outline"}
              onclick={() => removeSubscribedSection(section.id)}
            >
              {#if removingSectionId === section.id}
                <RefreshCw class="animate-spin" />
              {:else}
                <Trash2 />
              {/if}
              <span class="sr-only">
                {removingSectionId === section.id
                  ? subscriptionsCopy.removing
                  : pendingRemoveSectionId === section.id
                    ? subscriptionsCopy.optOutConfirm
                    : subscriptionsCopy.optOut}
              </span>
            </Button>
          </Table.Cell>
        </Table.Row>
      {/each}
    </Table.Body>
  </Table.Root>
</div>
