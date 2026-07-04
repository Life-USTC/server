<script lang="ts">
import type {
  DashboardDashboardCopy,
  DashboardSectionCopy,
  DashboardSubscriptionsCopy,
  SubscriptionsData,
} from "@/features/dashboard/lib/dashboard-controller-types";
import Trash2 from "$lib/components/icons/trash-2.svelte";
import { Button } from "$lib/components/ui/button/index.js";
import { Spinner } from "$lib/components/ui/spinner/index.js";

type SubscriptionSection =
  SubscriptionsData["subscriptions"][number]["sections"][number];
type SubscriptionSectionGroup = {
  key: string;
  label: string;
  startDate: string | null;
  sections: SubscriptionSection[];
};

export let dashboardCopy: DashboardDashboardCopy;
export let group: SubscriptionSectionGroup;
export let pendingRemoveSectionId: SubscriptionSection["id"] | null;
export let removeSubscribedSection: (
  sectionId: SubscriptionSection["id"],
) => void | Promise<void>;
export let removingSectionId: SubscriptionSection["id"] | null;
export let sectionCopy: DashboardSectionCopy;
export let subscriptionsCopy: DashboardSubscriptionsCopy;
</script>

<div class="grid min-w-0 overflow-hidden rounded-md border border-base-300">
  {#each group.sections as section}
    <div
      class="group/section-row grid min-w-0 gap-3 border-base-300 border-b p-3 last:border-b-0 md:grid-cols-[minmax(13rem,1.4fr)_minmax(8rem,0.8fr)_4rem_auto] md:items-center md:gap-4"
    >
      <a
        class="grid min-w-0 gap-1 text-base-content no-underline outline-none transition hover:text-primary hover:underline focus-visible:ring-2 focus-visible:ring-primary/30 md:grid-cols-[8.5rem_minmax(0,1fr)] md:items-center md:gap-4"
        href={`/sections/${section.jwId}`}
      >
        <span class="truncate font-mono text-primary text-sm md:text-base-content">
          {section.code}
        </span>
        <span class="truncate font-medium md:font-normal">
          {section.course.namePrimary ?? dashboardCopy.notAvailable}
        </span>
      </a>

      <div class="grid min-w-0 gap-1 text-sm">
        <span class="text-base-content/55 md:sr-only">{sectionCopy.teachers}</span>
        <span class="truncate">
          {section.teachers
            .map((teacher) => teacher.namePrimary)
            .join(", ") || sectionCopy.noTeachersListed}
        </span>
      </div>

      <div class="flex items-center justify-between gap-3 text-sm md:block">
        <span class="text-base-content/55 md:sr-only">{subscriptionsCopy.credits}</span>
        <span>{section.credits ?? dashboardCopy.notAvailable}</span>
      </div>

      <Button
        class={pendingRemoveSectionId === section.id
          ? undefined
          : "opacity-100 transition-opacity md:opacity-0 md:group-hover/section-row:opacity-100 md:group-focus-within/section-row:opacity-100"}
        disabled={removingSectionId === section.id}
        size="icon-sm"
        type="button"
        variant={pendingRemoveSectionId === section.id ? "destructive" : "outline"}
        onclick={() => removeSubscribedSection(section.id)}
      >
        {#if removingSectionId === section.id}
          <Spinner />
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
    </div>
  {/each}
</div>
