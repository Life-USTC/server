<script lang="ts">
import ArrowUpRight from "@lucide/svelte/icons/arrow-up-right";
import Pencil from "@lucide/svelte/icons/pencil";
import UserMinus from "@lucide/svelte/icons/user-minus";
import MobileListCard from "#lib/components/MobileListCard.svelte";
import TableIconButton from "#lib/components/TableIconButton.svelte";
import { Badge } from "#lib/components/ui/badge/index.js";
import * as Item from "#lib/components/ui/item/index.js";
import { Spinner } from "#lib/components/ui/spinner/index.js";
import SectionCardIdentity from "@/features/catalog/components/SectionCardIdentity.svelte";
import type {
  SubscriptionsData,
  WorkspaceCopy,
  WorkspaceSectionCopy,
  WorkspaceSubscriptionsCopy,
} from "@/features/workspace/lib/workspace-controller-types";

type SubscriptionListData = SubscriptionsData["subscriptions"];
type SubscriptionSection = SubscriptionListData[number]["sections"][number];

export let locale: string;
export let workspaceCopy: WorkspaceCopy;
export let readOnlyReason: string | undefined = undefined;
export let requestEditKind: (section: SubscriptionSection) => void;
export let requestRemoveSection: (section: SubscriptionSection) => void;
export let removingSectionId: SubscriptionSection["id"] | null;
export let sectionCopy: WorkspaceSectionCopy;
export let sections: SubscriptionSection[];
export let subscriptionsCopy: WorkspaceSubscriptionsCopy;

function courseName(section: SubscriptionSection) {
  return section.course.namePrimary ?? workspaceCopy.notAvailable;
}
</script>

<div class="min-w-0" data-testid="subscription-semester-cards">
  <Item.Group class="gap-0">
    {#each sections as section, index}
      <MobileListCard>
        <SectionCardIdentity course={section.course} teachers={section.teachers} code={section.code} semester={section.semester} {locale}>
          {#snippet title()}
            <a class="flex min-h-11 min-w-0 max-w-full items-center break-words font-medium hover:underline [overflow-wrap:anywhere]" href={`/catalog/sections/${section.jwId}`} data-testid="subscription-course-link">{courseName(section)}</a>
          {/snippet}
        </SectionCardIdentity>
        <Item.Footer class="flex-wrap justify-start gap-2">
          {#if section.kind !== "regular"}<Badge variant="secondary">{subscriptionsCopy.kindEditor[section.kind]}</Badge>{/if}
          <Badge variant="outline">{section.credits ?? workspaceCopy.notAvailable} {subscriptionsCopy.credits}</Badge>
        </Item.Footer>
        <Item.Actions class="shrink-0 self-start">
          <TableIconButton className="size-11" label={subscriptionsCopy.kindEditor.title} disabled={Boolean(readOnlyReason)} onclick={() => requestEditKind(section)}>
            <Pencil data-icon="inline-start" />
          </TableIconButton>
          <TableIconButton
            className="size-11"
            href={`/catalog/sections/${section.jwId}`}
            label={sectionCopy.moreDetails}
          >
            <ArrowUpRight data-icon="inline-start" />
          </TableIconButton>
          <TableIconButton
            className="size-11"
            disabled={Boolean(readOnlyReason) || removingSectionId === section.id}
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
      </MobileListCard>
      {#if index < sections.length - 1}
        <Item.Separator class="my-0" />
      {/if}
    {/each}
  </Item.Group>
</div>
