<script lang="ts">
import CollectionPage from "#lib/components/CollectionPage.svelte";
import EndlessScroll from "#lib/components/EndlessScroll.svelte";
import MobileListCard from "#lib/components/MobileListCard.svelte";
import ResponsiveCollection from "#lib/components/ResponsiveCollection.svelte";
import ResultsEmpty from "#lib/components/ResultsEmpty.svelte";
import SearchField from "#lib/components/SearchField.svelte";
import { Badge } from "#lib/components/ui/badge/index.js";
import { Button } from "#lib/components/ui/button/index.js";
import * as Item from "#lib/components/ui/item/index.js";
import * as Table from "#lib/components/ui/table/index.js";
import type {
  YoungOrganizerSummary,
  YoungSourceFreshness,
} from "@/features/young/server/young-event-service";
import type { EndlessScrollState } from "@/lib/navigation/endless-list.svelte";
import type { AppPageCopy } from "@/lib/shell/page-copy";
import { youngOrganizerTableFields } from "../lib/young-table-filters";
import YoungEventFilters from "./YoungEventFilters.svelte";
import YoungSourceNote from "./YoungSourceNote.svelte";

type Props = {
  copy: AppPageCopy;
  data: YoungOrganizerSummary[];
  endless: EndlessScrollState;
  tableFilters: Record<string, string>;
  source: YoungSourceFreshness;
};

let { copy, data, endless, tableFilters, source }: Props = $props();

let draft = $derived({ ...tableFilters });
const fields = $derived(youngOrganizerTableFields(copy));
function patchDraft(patch: Record<string, string>) {
  draft = { ...draft, ...patch };
}
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

{#snippet columnFilter(field: (typeof fields)[number], prefix: string)}
  <YoungEventFilters {copy} fields={[field]} values={draft} applied={tableFilters} onchange={patchDraft} label={field.label} prefix={`${prefix}-${field.name}`} formId="young-organizer-filters" />
{/snippet}

{#snippet empty()}
      <div class="py-10">
        <ResultsEmpty
          description={youngCopy.organizersDescription}
          title={youngCopy.noOrganizersFound}
        />
      </div>
{/snippet}

<CollectionPage
  description={youngCopy.organizersDescription}
  footer={endless.hasMore ? paginationFooter : undefined}
  title={youngCopy.organizersTitle}
>
  <section
    class="flex min-h-[calc(100dvh-16rem)] min-w-0 flex-col gap-3"
  >
      <div class="grid min-w-0 gap-3" data-slot="table-filter-toolbar">
      <form id="young-organizer-filters" action="/catalog/young-events/organizers" method="get" class="flex min-w-0 flex-wrap items-center gap-3" data-slot="table-filter-apply">
        {#each Object.entries(draft).filter(([, value]) => value) as [name, value]}
          <input type="hidden" {name} {value} />
        {/each}
        <div class="flex w-full min-w-0 sm:w-auto sm:flex-1">
          <SearchField id="young-organizer-search" label={copy.common.search} placeholder={youngCopy.organizerSearchPlaceholder} bind:value={() => draft.search ?? "", (value) => patchDraft({ search: value })} />
        </div>
        <Button type="submit">{copy.common.applyFilters}</Button>
        <Button type="button" variant="ghost" onclick={() => { draft = {}; }}>{copy.common.clear}</Button>
      </form>
      </div>
      {#if fields.some((field) => tableFilters[field.name])}
        <div class="flex flex-wrap gap-2" role="group" aria-label={youngCopy.activeFilters}>
          {#each fields.filter((field) => tableFilters[field.name]) as field}
            <Badge variant="outline" class="h-auto max-w-full whitespace-normal [overflow-wrap:anywhere]">{field.label}: {tableFilters[field.name]}</Badge>
          {/each}
        </div>
      {/if}
      <ResponsiveCollection>
        {#snippet mobile()}
          <div class="mb-3 flex flex-wrap gap-3" data-slot="collection-header">{#each fields as field}{@render columnFilter(field, "mobile")}{/each}</div>
          {#if data.length > 0}
          <Item.Group class="gap-0" role="list">
            {#each data as organizer, index (organizer.id)}
              <div role="listitem">
                <MobileListCard size="sm">
                  {#snippet child({ props })}
                    <a href={organizerHref(organizer.id)} {...props}>
                      <Item.Content>
                        <Item.Title>{organizer.name}</Item.Title>
                        <Item.Description title={youngCopy.organizerCountsHint}>
                            {youngCopy.activeEvents}: {organizer.activeCount} ·
                            {youngCopy.upcomingEvents}: {organizer.upcomingCount} ·
                            {youngCopy.historyEvents}: {organizer.historyCount}
                        </Item.Description>
                      </Item.Content>
                        <Item.Actions>
                          <span class="text-xs underline underline-offset-4">{youngCopy.organizerEvents}</span>
                        </Item.Actions>
                    </a>
                  {/snippet}
                </MobileListCard>
                {#if index < data.length - 1}
                  <Item.Separator />
                {/if}
              </div>
            {/each}
          </Item.Group>
          {:else}
            {@render empty()}
          {/if}
        {/snippet}
        {#snippet desktop()}
          <Table.Root>
            <Table.Header>
              <Table.Row>
                <Table.Head>{@render columnFilter(fields[0], "desktop")}</Table.Head>
                <Table.Head>{@render columnFilter(fields[1], "desktop")}</Table.Head>
                <Table.Head>{@render columnFilter(fields[2], "desktop")}</Table.Head>
                <Table.Head>{@render columnFilter(fields[3], "desktop")}</Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {#each data as organizer (organizer.id)}
                <Table.Row class="has-[a:hover]:bg-muted/50">
                  <Table.Cell class="p-0">
                      <a class="block px-4 py-3 font-medium underline-offset-4 hover:underline" href={organizerHref(organizer.id)}>
                        {organizer.name}
                      </a>
                  </Table.Cell>
                    <Table.Cell class="text-left tabular-nums">
                      <a class="underline underline-offset-4" href={eventsHref(organizer.id)}>{organizer.activeCount}</a>
                  </Table.Cell>
                    <Table.Cell class="text-left tabular-nums">{organizer.upcomingCount}</Table.Cell>
                    <Table.Cell class="text-left tabular-nums">{organizer.historyCount}</Table.Cell>
                </Table.Row>
              {/each}
            {#if data.length === 0}<Table.Row><Table.Cell colspan={4}>{@render empty()}</Table.Cell></Table.Row>{/if}
            </Table.Body>
          </Table.Root>
        {/snippet}
      </ResponsiveCollection>


    <div class="mt-auto grid justify-items-end gap-1 pt-8"><YoungSourceNote labels={youngCopy} source={source} /></div>
  </section>
</CollectionPage>
