<script lang="ts">
import CollectionEmpty from "#lib/components/CollectionEmpty.svelte";
import CollectionPage from "#lib/components/CollectionPage.svelte";
import EndlessScroll from "#lib/components/EndlessScroll.svelte";
import RecordCollection from "#lib/components/RecordCollection.svelte";
import type {
  YoungOrganizerSummary,
  YoungSourceFreshness,
} from "@/features/young/server/young-event-service";
import type { EndlessScrollState } from "@/lib/navigation/endless-list.svelte";
import type { AppPageCopy } from "@/lib/shell/page-copy";
import { youngOrganizerTableFields } from "../lib/young-table-filters";
import YoungFilterToolbar from "./YoungFilterToolbar.svelte";
import YoungSourceNote from "./YoungSourceNote.svelte";

type Props = {
  copy: AppPageCopy;
  data: YoungOrganizerSummary[];
  endless: EndlessScrollState;
  tableFilters: Record<string, string>;
  source: YoungSourceFreshness;
};

let { copy, data, endless, tableFilters, source }: Props = $props();

const youngCopy = $derived(copy.youngEvents);
const commonLabels = $derived(copy.common);

function organizerHref(id: string) {
  return `/catalog/young-events/organizers/${id}`;
}

function eventsHref(id: string) {
  return `/catalog/young-events?active=true&organizerId=${encodeURIComponent(id)}`;
}
</script>

{#snippet paginationFooter()}
  <EndlessScroll state={endless} labels={commonLabels.endlessScroll} />
{/snippet}

{#snippet activeCount(row: YoungOrganizerSummary)}
  <a href={eventsHref(row.id)}>{row.activeCount}</a>
{/snippet}

<CollectionPage
  description={youngCopy.organizersDescription}
  footer={endless.hasMore ? paginationFooter : undefined}
  title={youngCopy.organizersTitle}
>
  <section
    class="flex min-h-[calc(100dvh-16rem)] min-w-0 flex-col gap-3"
  >
    <YoungFilterToolbar
      {copy}
      id="young-organizer-filters"
      action="/catalog/young-events/organizers"
      placeholder={youngCopy.organizerSearchPlaceholder}
      applied={tableFilters}
      fieldsFor={() => youngOrganizerTableFields(copy)}
    />
    {#if data.length}
      <RecordCollection secondaryLinks
        rows={data}
        href={row => organizerHref(row.id)}
        titleLabel={youngCopy.organizer}
        titleText={row => row.name}
        fields={[
          { label: youngCopy.activeEvents, content: activeCount },
          { label: youngCopy.upcomingEvents, text: row => row.upcomingCount },
          { label: youngCopy.historyEvents, text: row => row.historyCount }
        ]}
      />
    {:else}
      <CollectionEmpty variant={Object.values(tableFilters).some(Boolean) ? "filter-clear" : "browse"} clearFilterLabel={commonLabels.clear} clearHref="/catalog/young-events/organizers" description={youngCopy.organizersDescription} title={youngCopy.noOrganizersFound} />
    {/if}

    <div class="mt-auto grid justify-items-end gap-1 pt-8"><YoungSourceNote labels={youngCopy} source={source} /></div>
  </section>
</CollectionPage>
