<script lang="ts">
import type {
  YoungEventPage,
  YoungEventSummary,
  YoungOrganizerSummary,
  YoungSourceFreshness,
} from "@/features/young/server/young-event-service";
import type { AppPageCopy } from "@/lib/shell/page-copy";
import { page } from "$app/stores";
import CollectionPage from "$lib/components/CollectionPage.svelte";
import DetailDefinitionList from "$lib/components/DetailDefinitionList.svelte";
import ListPagination from "$lib/components/ListPagination.svelte";
import Panel from "$lib/components/Panel.svelte";
import ResultsEmpty from "$lib/components/ResultsEmpty.svelte";
import ResultsSummary from "$lib/components/ResultsSummary.svelte";
import { Button } from "$lib/components/ui/button/index.js";
import * as Item from "$lib/components/ui/item/index.js";
import { youngDateRange, youngDateTime } from "../lib/young-event-display";
import { youngDetailHref } from "../lib/young-navigation";
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

{#snippet paginationFooter()}
      <ListPagination ariaLabel={copy.common.pagination} nextLabel={copy.common.next} nextPageLabel={copy.common.nextPage} previousLabel={copy.common.previous} previousPageLabel={copy.common.previousPage} page={events.pagination.page} totalPages={events.pagination.totalPages} {pageHref} />
{/snippet}

<CollectionPage
  breadcrumb={[
    { href: "/catalog/young-events", label: youngCopy.title },
    { href: "/catalog/young-events/organizers", label: youngCopy.organizersTitle },
    { label: organizer.name },
  ]}
  breadcrumbLabel={copy.common.breadcrumb}
  description={youngCopy.organizersDescription}
  layout="detail"
  title={organizer.name}
>
  {#snippet actions()}
        <Button href={`/catalog/young-events?organizerId=${encodeURIComponent(organizer.id)}`} variant="outline">
          {youngCopy.organizerEvents}
        </Button>
  {/snippet}
      <Panel footer={events.pagination.totalPages > 1 ? paginationFooter : undefined}>
        {#snippet header()}
          <h2 class="font-medium text-base">{youngCopy.organizerEvents}</h2>
        {/snippet}
        <div class="grid gap-3">
        <ResultsSummary summary={youngCopy.showing.replace("{count}", String(events.data.length)).replace("{total}", String(events.pagination.total))} page={events.pagination.page} totalPages={events.pagination.totalPages} />
        {#if events.data.length > 0}
          <Item.Group class="gap-0" role="list">
            {#each events.data as event, index (event.youngId)}
              <div role="listitem">
                <Item.Root size="sm" variant={event.sourceMissing ? "muted" : "outline"}>
                  {#snippet child({ props })}
                    <a href={youngDetailHref(event.youngId, $page.url)} {...props}>
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
          <ResultsEmpty title={youngCopy.noEventsFound} description={youngCopy.organizersDescription} />
        {/if}
        </div>
      </Panel>
  {#snippet aside()}
    <p class="text-sm text-muted-foreground" data-testid="young-source-freshness">
      {#if source.status === "fresh"}
        {youngCopy.sourceFresh}
      {:else if source.status === "stale"}
        {youngCopy.sourceStale}
      {:else}
        {youngCopy.sourceUnknown}
      {/if}
      {#if source.lastSyncedAt} · {formatSourceDate(source.lastSyncedAt)}{/if}
    </p>
    <YoungSubscriptionControl id={organizer.id} kind="organizers" copy={youngCopy.workspace} />
    <DetailDefinitionList
      items={[
        { label: youngCopy.organizerEvents, value: String(organizer.totalCount) },
        { label: youngCopy.activeEvents, value: String(organizer.activeCount) },
        { label: youngCopy.upcomingEvents, value: String(organizer.upcomingCount) },
        { label: youngCopy.historyEvents, value: String(organizer.historyCount) },
      ]}
    />
    <p class="text-sm text-muted-foreground">{youngCopy.organizerCountsHint}</p>
  {/snippet}
</CollectionPage>
