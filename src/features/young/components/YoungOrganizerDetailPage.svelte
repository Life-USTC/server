<script lang="ts">
import CatalogPagination from "@/features/catalog/components/CatalogPagination.svelte";
import type {
  YoungEventPage,
  YoungEventSummary,
  YoungOrganizerSummary,
  YoungSourceFreshness,
} from "@/features/young/server/young-event-service";
import type { AppPageCopy } from "@/lib/shell/page-copy";
import PageLayout from "$lib/components/PageLayout.svelte";
import Panel from "$lib/components/Panel.svelte";
import { Button } from "$lib/components/ui/button/index.js";
import * as Item from "$lib/components/ui/item/index.js";
import { youngDateRange, youngDateTime } from "../lib/young-event-display";
import YoungSubscriptionControl from "./YoungSubscriptionControl.svelte";

type Props = {
  copy: AppPageCopy;
  organizer: YoungOrganizerSummary;
  source: YoungSourceFreshness;
  events: YoungEventPage;
};

let { copy, organizer, source, events }: Props = $props();

const youngCopy = $derived(copy.youngEvents);

function formatRange(event: YoungEventSummary) {
  return (
    youngDateRange(event.startAt, event.endAt, youngCopy) ??
    youngCopy.unknownTime
  );
}

function formatSourceDate(value: string | null) {
  return youngDateTime(value) ?? youngCopy.unknownValue;
}

function pageHref(page: number) {
  return `?page=${page}`;
}
</script>

<PageLayout
  description={youngCopy.organizersDescription}
  title={organizer.name}
>
  <div class="grid gap-5">
    <div class="flex flex-wrap items-center justify-between gap-3 text-sm" data-testid="young-source-freshness">
      <span class="text-muted-foreground">
        {#if source.status === "fresh"}
          {youngCopy.sourceFresh}
        {:else if source.status === "stale"}
          {youngCopy.sourceStale}
        {:else}
          {youngCopy.sourceUnknown}
        {/if}
        {#if source.lastSyncedAt} · {formatSourceDate(source.lastSyncedAt)}{/if}
      </span>
      <div class="flex flex-wrap gap-2">
        <Button href={`/catalog/young-events?organizerId=${encodeURIComponent(organizer.id)}`} variant="outline">
          {youngCopy.organizerEvents}
        </Button>
        <Button href="/catalog/young-events/organizers" variant="outline">
          {youngCopy.viewOrganizers}
        </Button>
      </div>
    </div>

    <YoungSubscriptionControl id={organizer.id} kind="organizers" copy={youngCopy.workspace} />
    <dl class="flex flex-wrap gap-6 text-sm">
      <div><dt class="text-muted-foreground">{youngCopy.organizerEvents}</dt><dd>{organizer.totalCount}</dd></div>
      <div><dt class="text-muted-foreground">{youngCopy.activeEvents}</dt><dd>{organizer.activeCount}</dd></div>
      <div><dt class="text-muted-foreground">{youngCopy.upcomingEvents}</dt><dd>{organizer.upcomingCount}</dd></div>
      <div><dt class="text-muted-foreground">{youngCopy.historyEvents}</dt><dd>{organizer.historyCount}</dd></div>
    </dl>
      <Panel>
        {#snippet header()}
          <h2 class="font-medium text-base">{youngCopy.organizerEvents}</h2>
        {/snippet}
        {#if events.data.length > 0}
          <Item.Group class="gap-0" role="list">
            {#each events.data as event, index (event.youngId)}
              <div role="listitem">
                <Item.Root size="sm" variant={event.sourceMissing ? "muted" : "outline"}>
                  {#snippet child({ props })}
                    <a href={`/catalog/young-events/${event.youngId}`} {...props}>
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
                </Item.Root>
                {#if index < events.data.length - 1}
                  <Item.Separator />
                {/if}
              </div>
            {/each}
          </Item.Group>
        {:else}
          <p class="text-muted-foreground text-sm">{youngCopy.calendarEmpty}</p>
        {/if}
      </Panel>
    {#if events.pagination.totalPages > 1}
      <CatalogPagination ariaLabel={copy.common.pagination} nextLabel={copy.common.next} nextPageLabel={copy.common.nextPage} previousLabel={copy.common.previous} previousPageLabel={copy.common.previousPage} page={events.pagination.page} totalPages={events.pagination.totalPages} {pageHref} />
    {/if}

    <div>
      <Button href="/catalog/young-events/organizers" variant="outline">
        {youngCopy.viewOrganizers}
      </Button>
    </div>
  </div>
</PageLayout>
