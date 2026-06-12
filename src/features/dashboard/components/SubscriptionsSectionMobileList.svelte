<script lang="ts">
import type {
  DashboardDashboardCopy,
  DashboardSectionCopy,
  DashboardSubscriptionsCopy,
  SubscriptionsData,
} from "@/features/dashboard/lib/dashboard-controller-types";
import { Button } from "$lib/components/ui/button/index.js";

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

<div class="grid gap-2 md:hidden">
  {#each sections as section}
    <div class="grid gap-3 border-base-300 border-b py-3 last:border-b-0">
      <div class="grid min-w-0 gap-1">
        <a
          class="break-all font-mono text-primary text-sm underline-offset-4 hover:underline"
          href={`/sections/${section.jwId}`}
        >
          {section.code}
        </a>
        <a
          class="font-medium text-base-content underline-offset-4 hover:underline"
          href={`/sections/${section.jwId}`}
        >
          {section.course.namePrimary ?? dashboardCopy.notAvailable}
        </a>
      </div>
      <dl class="grid gap-2 text-sm">
        <div class="grid gap-1">
          <dt class="text-base-content/55">{sectionCopy.teachers}</dt>
          <dd>
            {section.teachers
              .map((teacher) => teacher.namePrimary)
              .join(", ") || sectionCopy.noTeachersListed}
          </dd>
        </div>
        <div class="flex items-center justify-between gap-3">
          <dt class="text-base-content/55">{subscriptionsCopy.credits}</dt>
          <dd>{section.credits ?? dashboardCopy.notAvailable}</dd>
        </div>
      </dl>
      <Button
        class={pendingRemoveSectionId === section.id
          ? "border-error bg-error text-error-content hover:bg-error/90"
          : ""}
        disabled={removingSectionId === section.id}
        size="sm"
        type="button"
        variant={pendingRemoveSectionId === section.id
          ? "default"
          : "outline"}
        onclick={() => removeSubscribedSection(section.id)}
      >
        {removingSectionId === section.id
          ? subscriptionsCopy.removing
          : pendingRemoveSectionId === section.id
            ? subscriptionsCopy.optOutConfirm
            : subscriptionsCopy.optOut}
      </Button>
    </div>
  {/each}
</div>
