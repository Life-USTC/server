<script lang="ts">
import ArrowUpRight from "@lucide/svelte/icons/arrow-up-right";
import UserMinus from "@lucide/svelte/icons/user-minus";
import type {
  SubscriptionsData,
  WorkspaceCopy,
  WorkspaceSectionCopy,
  WorkspaceSubscriptionsCopy,
} from "@/features/workspace/lib/workspace-controller-types";
import TableIconButton from "$lib/components/TableIconButton.svelte";
import { Badge } from "$lib/components/ui/badge/index.js";
import * as Item from "$lib/components/ui/item/index.js";
import { Spinner } from "$lib/components/ui/spinner/index.js";

type SubscriptionListData = SubscriptionsData["subscriptions"];
type SubscriptionSection = SubscriptionListData[number]["sections"][number];

export let workspaceCopy: WorkspaceCopy;
export let requestRemoveSection: (section: SubscriptionSection) => void;
export let removingSectionId: SubscriptionSection["id"] | null;
export let sectionCopy: WorkspaceSectionCopy;
export let sections: SubscriptionSection[];
export let subscriptionsCopy: WorkspaceSubscriptionsCopy;

function teacherNames(section: SubscriptionSection) {
  return (
    section.teachers
      .map((teacher) => teacher.namePrimary)
      .filter(Boolean)
      .join(", ") || sectionCopy.noTeachersListed
  );
}

function courseName(section: SubscriptionSection) {
  return section.course.namePrimary ?? workspaceCopy.notAvailable;
}
</script>

<div class="min-w-0" data-testid="subscription-semester-cards">
  <Item.Group class="gap-0">
    {#each sections as section, index}
      <Item.Root class="items-start gap-3 px-2 py-3">
        <Item.Content class="min-w-0 gap-1">
          <Item.Title class="line-clamp-none w-full min-w-0">
            <a
              class="flex min-h-11 w-full min-w-0 max-w-full items-center font-medium hover:underline"
              href={`/catalog/sections/${section.jwId}`}
              data-testid="subscription-course-link"
            >
              <span class="line-clamp-2 min-w-0 max-w-full break-words">
                {courseName(section)}
              </span>
            </a>
          </Item.Title>
          <Item.Description
            class="line-clamp-none flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 break-words"
          >
            <span class="max-w-full break-words">{teacherNames(section)}</span>
            <Badge variant="outline">
              {section.credits ?? workspaceCopy.notAvailable}
              {subscriptionsCopy.credits}
            </Badge>
          </Item.Description>
        </Item.Content>
        <Item.Actions class="shrink-0 self-start">
          <TableIconButton
            className="size-11"
            href={`/catalog/sections/${section.jwId}`}
            label={sectionCopy.moreDetails}
          >
            <ArrowUpRight data-icon="inline-start" />
          </TableIconButton>
          <TableIconButton
            className="size-11"
            disabled={removingSectionId === section.id}
            label={subscriptionsCopy.unsubscribe}
            variant="destructive"
            onclick={() => requestRemoveSection(section)}
          >
            {#if removingSectionId === section.id}
              <Spinner data-icon="inline-start" />
            {:else}
              <UserMinus data-icon="inline-start" />
            {/if}
          </TableIconButton>
        </Item.Actions>
      </Item.Root>
      {#if index < sections.length - 1}
        <Item.Separator class="my-0" />
      {/if}
    {/each}
  </Item.Group>
</div>
