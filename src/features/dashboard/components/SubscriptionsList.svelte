<script lang="ts">
import type {
  DashboardDashboardCopy,
  DashboardSectionCopy,
  DashboardSubscriptionsCopy,
  SubscriptionsData,
} from "@/features/dashboard/lib/dashboard-controller-types";
import { groupSubscribedSectionsBySemester } from "@/features/dashboard/lib/subscriptions";
import DashboardNoSubscriptionsState from "./DashboardNoSubscriptionsState.svelte";
import SubscriptionsSectionGroup from "./SubscriptionsSectionGroup.svelte";
import type { FormatMessage } from "./subscription-tab-types";

type SubscriptionListData = SubscriptionsData["subscriptions"];
type SubscriptionSection = SubscriptionListData[number]["sections"][number];

export let dashboardCopy: DashboardDashboardCopy;
export let formatMessage: FormatMessage;
export let pendingRemoveSectionId: SubscriptionSection["id"] | null;
export let removeSubscribedSection: (
  sectionId: SubscriptionSection["id"],
) => void | Promise<void>;
export let removingSectionId: SubscriptionSection["id"] | null;
export let sectionCopy: DashboardSectionCopy;
export let subscriptions: SubscriptionListData;
export let subscriptionsCopy: DashboardSubscriptionsCopy;
</script>

{#if subscriptions.length > 0}
  {#each subscriptions as subscription}
    <section class="grid min-w-0 gap-4">
      <div class="grid min-w-0 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {#each groupSubscribedSectionsBySemester(subscription.sections, dashboardCopy.notAvailable) as group}
          <div class="grid min-w-0 gap-2">
            <div class="flex flex-wrap items-center justify-between gap-2 text-sm">
              <div class="font-medium">
                {formatMessage(subscriptionsCopy.semesterGroup, {
                  name: group.label,
                })}
              </div>
              <div class="text-base-content/60">
                {formatMessage(subscriptionsCopy.sectionsIncluded, {
                  count: group.sections.length,
                })}
              </div>
            </div>
            <SubscriptionsSectionGroup
              {dashboardCopy}
              {group}
              {pendingRemoveSectionId}
              {removeSubscribedSection}
              {removingSectionId}
              {sectionCopy}
              {subscriptionsCopy}
            />
          </div>
        {/each}
      </div>
    </section>
  {/each}
{:else}
  <DashboardNoSubscriptionsState
    title={subscriptionsCopy.noSubscriptions}
    description={subscriptionsCopy.noSubscriptionsDescription}
    actions={[
      { href: "/sections", label: subscriptionsCopy.browseSections },
      { href: "/courses", label: subscriptionsCopy.browseCourses, variant: "outline" },
    ]}
  />
{/if}
