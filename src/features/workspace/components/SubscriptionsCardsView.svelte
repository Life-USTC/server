<script lang="ts">
import ArrowUpRight from "@lucide/svelte/icons/arrow-up-right";
import ClassIcon from "@lucide/svelte/icons/graduation-cap";
import Pencil from "@lucide/svelte/icons/pencil";
import UserMinus from "@lucide/svelte/icons/user-minus";
import MobileListCard from "#lib/components/MobileListCard.svelte";
import TableIconButton from "#lib/components/TableIconButton.svelte";
import TruncatedText from "#lib/components/TruncatedText.svelte";
import { Badge } from "#lib/components/ui/badge/index.js";
import * as Item from "#lib/components/ui/item/index.js";
import type {
  SubscriptionsData,
  WorkspaceCopy,
  WorkspaceSectionCopy,
  WorkspaceSubscriptionsCopy,
} from "@/features/workspace/lib/workspace-controller-types";

type SubscriptionListData = SubscriptionsData["subscriptions"];
type SubscriptionSection = SubscriptionListData[number]["sections"][number];

export let courseName: (section: SubscriptionSection) => string;
export let teacherNames: (section: SubscriptionSection) => string;
export let workspaceCopy: WorkspaceCopy;
export let readOnlyReason: string | undefined = undefined;
export let requestEditKind: (section: SubscriptionSection) => void;
export let requestRemoveSection: (section: SubscriptionSection) => void;
export let removingSectionId: SubscriptionSection["id"] | null;
export let sectionCopy: WorkspaceSectionCopy;
export let sections: SubscriptionSection[];
export let subscriptionsCopy: WorkspaceSubscriptionsCopy;
</script>

<div class="min-w-0" data-testid="subscription-semester-cards">
  <Item.Group class="gap-0">
    {#each sections as section, index}
      <MobileListCard>
        <Item.Content class="min-w-0 basis-full">
          <Item.Title class="block w-full line-clamp-none text-base">
            <a class="flex min-h-11 min-w-0 items-center gap-1.5 break-words [overflow-wrap:anywhere]" href={`/catalog/sections/${section.jwId}`} data-testid="subscription-course-link"><ClassIcon aria-hidden="true" class="size-4 shrink-0" />{courseName(section)}</a>
          </Item.Title>
          <TruncatedText class="text-sm text-muted-foreground" text={teacherNames(section)} />
        </Item.Content>
        <Item.Footer class="flex-wrap justify-start gap-2">
          {#if section.kind !== "regular"}<Badge variant="secondary">{subscriptionsCopy.kindEditor[section.kind]}</Badge>{/if}
          <Badge variant="outline">{section.credits ?? workspaceCopy.notAvailable} {subscriptionsCopy.credits}</Badge>
        </Item.Footer>
        <Item.Actions class="shrink-0 self-start">
          <TableIconButton label={subscriptionsCopy.kindEditor.title} disabled={Boolean(readOnlyReason)} onclick={() => requestEditKind(section)} icon={Pencil} />
          <TableIconButton
            href={`/catalog/sections/${section.jwId}`}
            label={sectionCopy.moreDetails}
            icon={ArrowUpRight}
          />
          <TableIconButton
            disabled={Boolean(readOnlyReason) || removingSectionId === section.id}
            label={subscriptionsCopy.unsubscribe}
            variant="destructive"
            onclick={() => requestRemoveSection(section)}
            icon={UserMinus}
            loading={removingSectionId === section.id}
          />
        </Item.Actions>
      </MobileListCard>
      {#if index < sections.length - 1}
        <Item.Separator class="my-0" />
      {/if}
    {/each}
  </Item.Group>
</div>
