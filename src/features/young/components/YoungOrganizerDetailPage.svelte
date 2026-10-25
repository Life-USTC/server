<script lang="ts">
import CollectionPage from "#lib/components/CollectionPage.svelte";
import DetailDefinitionList from "#lib/components/DetailDefinitionList.svelte";
import EndlessScroll from "#lib/components/EndlessScroll.svelte";
import MobileListCard from "#lib/components/MobileListCard.svelte";
import Panel from "#lib/components/Panel.svelte";
import ResultsEmpty from "#lib/components/ResultsEmpty.svelte";
import { Button } from "#lib/components/ui/button/index.js";
import * as Item from "#lib/components/ui/item/index.js";
import type {
  YoungEventPage,
  YoungEventSummary,
  YoungOrganizerSummary,
  YoungSourceFreshness,
} from "@/features/young/server/young-event-service";
import type { EndlessScrollState } from "@/lib/navigation/endless-list.svelte";
import type { AppPageCopy } from "@/lib/shell/page-copy";
import { youngDateRange } from "../lib/young-event-display";
import { youngDetailHref } from "../lib/young-navigation";
import YoungSourceNote from "./YoungSourceNote.svelte";
import YoungSubscriptionControl from "./YoungSubscriptionControl.svelte";

type Props = {
  copy: AppPageCopy;
  organizer: YoungOrganizerSummary;
  source: YoungSourceFreshness;
  events: YoungEventPage;
  endless: EndlessScrollState;
};

let { copy, organizer, source, events, endless }: Props = $props();

const youngCopy = $derived(copy.youngEvents);

function formatRange(event: YoungEventSummary) {
  return (
    youngDateRange(event.startAt, event.endAt, youngCopy) ??
    youngCopy.unknownTime
  );
}
</script>

{#snippet paginationFooter()}
  <EndlessScroll state={endless} labels={copy.common.endlessScroll} />
{/snippet}

<CollectionPage
  description={youngCopy.organizersDescription}
  layout="detail"
  title={organizer.name}
>
  {#snippet actions()}
        <Button href={`/catalog/young-events?organizerId=${encodeURIComponent(organizer.id)}`} variant="outline">
          {youngCopy.organizerEvents}
        </Button>
  {/snippet}
      <Panel footer={endless.hasMore ? paginationFooter : undefined}>
        {#snippet header()}
          <h2 class="font-medium text-base">{youngCopy.organizerEvents}</h2>
        {/snippet}
        <div class="grid gap-3">
        {#if events.data.length > 0}
          <Item.Group class="gap-0" role="list">
            {#each events.data as event, index (event.youngId)}
              <div role="listitem">
                <MobileListCard size="sm" variant={event.sourceMissing ? "muted" : "outline"}>
                  {#snippet child({ props })}
                    <a href={youngDetailHref(event.youngId)} {...props}>
                      <Item.Content>
                        <Item.Title>{event.name}</Item.Title>
                        <Item.Description>
                          {formatRange(event)}{#if event.location} · {event.location}{/if}{#if event.isOnline === true} · {youngCopy.online}{/if}
                        </Item.Description>
                        <Item.Footer class="flex-wrap justify-start">
                          {#if event.category}<span>{event.category}</span>{/if}
                          {#if event.status}<span>{event.status}</span>{/if}
                          {#if event.requiresSignup === false}<span>{youngCopy.signupNotRequired}</span>{/if}
                          {#if event.sourceMissing}<span>{youngCopy.sourceMissing}</span>{/if}
                        </Item.Footer>
                      </Item.Content>
                    </a>
                  {/snippet}
                </MobileListCard>
                {#if index < events.data.length - 1}
                  <Item.Separator />
                {/if}
              </div>
            {/each}
          </Item.Group>
        {:else}
          <ResultsEmpty title={youngCopy.noEventsFound} description={youngCopy.organizersDescription} />
        {/if}
        </div>
      </Panel>
  {#snippet aside()}
    <YoungSubscriptionControl id={organizer.id} kind="organizers" copy={youngCopy.workspace} />
    <DetailDefinitionList
      items={[
        { label: youngCopy.organizerEvents, value: String(organizer.totalCount) },
        { label: youngCopy.activeEvents, value: String(organizer.activeCount) },
        { label: youngCopy.upcomingEvents, value: String(organizer.upcomingCount) },
        { label: youngCopy.historyEvents, value: String(organizer.historyCount) },
      ]}
    />
    <YoungSourceNote labels={youngCopy} {source} />
  {/snippet}
</CollectionPage>
