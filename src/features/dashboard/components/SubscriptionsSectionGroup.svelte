<script lang="ts">
import Trash2 from "@lucide/svelte/icons/trash-2";
import type {
  DashboardDashboardCopy,
  DashboardSectionCopy,
  DashboardSubscriptionsCopy,
  SubscriptionsData,
} from "@/features/dashboard/lib/dashboard-controller-types";
import { Button } from "$lib/components/ui/button/index.js";
import * as Item from "$lib/components/ui/item/index.js";
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

<Item.Group class="min-w-0 gap-2">
  {#each group.sections as section}
    <Item.Root
      class="group/section-row items-start md:flex-nowrap"
      size="sm"
      variant="outline"
    >
      <Item.Content class="min-w-0 md:min-w-80">
        <a
          class="grid min-w-0 gap-1 no-underline outline-none md:grid-cols-[8.5rem_minmax(0,1fr)] md:items-center md:gap-4"
          href={`/sections/${section.jwId}`}
        >
          <Item.Title class="font-mono text-primary md:text-foreground">
            {section.code}
          </Item.Title>
          <Item.Title class="font-medium md:font-normal">
            {section.course.namePrimary ?? dashboardCopy.notAvailable}
          </Item.Title>
        </a>
      </Item.Content>

      <Item.Content class="min-w-0 basis-full md:basis-64">
        <Item.Description class="md:sr-only">{sectionCopy.teachers}</Item.Description>
        <Item.Title class="font-normal">
          {section.teachers
            .map((teacher) => teacher.namePrimary)
            .join(", ") || sectionCopy.noTeachersListed}
        </Item.Title>
      </Item.Content>

      <Item.Content class="basis-auto grow-0">
        <Item.Description class="md:sr-only">{subscriptionsCopy.credits}</Item.Description>
        <Item.Title>{section.credits ?? dashboardCopy.notAvailable}</Item.Title>
      </Item.Content>

      <Item.Actions class="ms-auto">
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
            <Spinner data-icon="inline-start" />
          {:else}
            <Trash2 data-icon="inline-start" />
          {/if}
          <span class="sr-only">
            {removingSectionId === section.id
              ? subscriptionsCopy.removing
              : pendingRemoveSectionId === section.id
                ? subscriptionsCopy.optOutConfirm
                : subscriptionsCopy.optOut}
          </span>
        </Button>
      </Item.Actions>
    </Item.Root>
  {/each}
</Item.Group>
