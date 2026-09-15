<script lang="ts">
import type {
  YoungEventSummary,
  YoungOrganizerSummary,
  YoungSourceFreshness,
} from "@/features/young/server/young-event-service";
import type { AppPageCopy } from "@/lib/shell/page-copy";
import PageLayout from "$lib/components/PageLayout.svelte";
import Panel from "$lib/components/Panel.svelte";
import { Button } from "$lib/components/ui/button/index.js";
import * as Item from "$lib/components/ui/item/index.js";

type Props = {
  copy: AppPageCopy;
  organizer: YoungOrganizerSummary;
  source: YoungSourceFreshness;
};

let { copy, organizer, source }: Props = $props();

const youngCopy = $derived(copy.youngEvents);

function formatDateTime(value: string | null) {
  return value ? value.slice(0, 16).replace("T", " ") : "-";
}

function formatRange(event: YoungEventSummary) {
  if (!event.startAt && !event.endAt) return "-";
  return `${formatDateTime(event.startAt)} ~ ${formatDateTime(event.endAt)}`;
}

function formatSourceDate(value: string | null) {
  return value ? value.slice(0, 16).replace("T", " ") : "-";
}

const sections = $derived([
  { events: organizer.activeEvents, label: youngCopy.activeEvents },
  { events: organizer.upcomingEvents, label: youngCopy.upcomingEvents },
  { events: organizer.historyEvents, label: youngCopy.historyEvents },
]);
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

    {#each sections as section (section.label)}
      <Panel>
        {#snippet header()}
          <h2 class="font-medium text-base">{section.label}</h2>
        {/snippet}
        {#if section.events.length > 0}
          <Item.Group class="gap-0" role="list">
            {#each section.events as event, index (event.youngId)}
              <div role="listitem">
                <Item.Root size="sm" variant={event.sourceMissing ? "muted" : "outline"}>
                  {#snippet child({ props })}
                    <a href={`/catalog/young-events/${event.youngId}`} {...props}>
                      <Item.Content>
                        <Item.Title>{event.name}</Item.Title>
                        <Item.Description>
                          {formatRange(event)} · {event.location ?? youngCopy.location}
                        </Item.Description>
                        <Item.Footer class="flex-wrap justify-start">
                          <span>{event.category ?? youngCopy.category}</span>
                          <span>{event.registrationStatus ?? event.status ?? "-"}</span>
                          {#if event.sourceMissing}<span>{youngCopy.sourceMissing}</span>{/if}
                        </Item.Footer>
                      </Item.Content>
                    </a>
                  {/snippet}
                </Item.Root>
                {#if index < section.events.length - 1}
                  <Item.Separator />
                {/if}
              </div>
            {/each}
          </Item.Group>
        {:else}
          <p class="text-muted-foreground text-sm">{youngCopy.calendarEmpty}</p>
        {/if}
      </Panel>
    {/each}

    <div>
      <Button href="/catalog/young-events/organizers" variant="outline">
        {youngCopy.viewOrganizers}
      </Button>
    </div>
  </div>
</PageLayout>
