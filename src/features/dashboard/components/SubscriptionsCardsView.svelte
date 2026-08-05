<script lang="ts">
import ArrowUpRight from "@lucide/svelte/icons/arrow-up-right";
import UserMinus from "@lucide/svelte/icons/user-minus";
import type {
  DashboardDashboardCopy,
  DashboardSectionCopy,
  DashboardSubscriptionsCopy,
  SubscriptionsData,
} from "@/features/dashboard/lib/dashboard-controller-types";
import { Badge } from "$lib/components/ui/badge/index.js";
import { Spinner } from "$lib/components/ui/spinner/index.js";
import DashboardTableIconButton from "./DashboardTableIconButton.svelte";

type SubscriptionListData = SubscriptionsData["subscriptions"];
type SubscriptionSection = SubscriptionListData[number]["sections"][number];

export let dashboardCopy: DashboardDashboardCopy;
export let requestRemoveSection: (section: SubscriptionSection) => void;
export let removingSectionId: SubscriptionSection["id"] | null;
export let sectionCopy: DashboardSectionCopy;
export let sections: SubscriptionSection[];
export let subscriptionsCopy: DashboardSubscriptionsCopy;

function teacherNames(section: SubscriptionSection) {
  return (
    section.teachers
      .map((teacher) => teacher.namePrimary)
      .filter(Boolean)
      .join(", ") || sectionCopy.noTeachersListed
  );
}

function courseName(section: SubscriptionSection) {
  return section.course.namePrimary ?? dashboardCopy.notAvailable;
}
</script>

<div class="grid gap-3" data-testid="subscription-semester-cards">
  {#each sections as section}
    <div class="group grid gap-2 border-b border-border/60 py-3 last:border-b-0">
      <div class="flex items-start justify-between gap-3">
        <div class="grid min-w-0 gap-1">
          <a
            class="font-medium hover:underline"
            href={`/catalog/sections/${section.jwId}`}
            data-testid="subscription-course-link"
          >
            {courseName(section)}
          </a>
          <p class="text-muted-foreground text-sm">{teacherNames(section)}</p>
        </div>
        <div class="flex shrink-0 items-center gap-1">
          <Badge variant="outline">
            {section.credits ?? dashboardCopy.notAvailable}
            {subscriptionsCopy.credits}
          </Badge>
          <DashboardTableIconButton
            disabled={removingSectionId === section.id}
            label={subscriptionsCopy.unsubscribe}
            variant="destructive"
            onclick={() => requestRemoveSection(section)}
          >
            {#if removingSectionId === section.id}
              <Spinner />
            {:else}
              <UserMinus />
            {/if}
          </DashboardTableIconButton>
          <DashboardTableIconButton
            href={`/catalog/sections/${section.jwId}`}
            label={sectionCopy.moreDetails}
          >
            <ArrowUpRight />
          </DashboardTableIconButton>
        </div>
      </div>
    </div>
  {/each}
</div>
