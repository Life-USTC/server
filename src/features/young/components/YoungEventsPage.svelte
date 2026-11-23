<script lang="ts">
import CollectionEmpty from "#lib/components/CollectionEmpty.svelte";
import CollectionPage from "#lib/components/CollectionPage.svelte";
import EndlessScroll from "#lib/components/EndlessScroll.svelte";
import RecordCollection from "#lib/components/RecordCollection.svelte";
import { Badge } from "#lib/components/ui/badge/index.js";
import { resolveStatusToken } from "#lib/ui/action-status-tokens.js";
import type {
  YoungEventSummary,
  YoungOrganizerSummary,
  YoungSourceFreshness,
} from "@/features/young/server/young-event-service";
import type { EndlessScrollState } from "@/lib/navigation/endless-list.svelte";
import type { AppPageCopy } from "@/lib/shell/page-copy";
import { page as appPage } from "$app/state";
import {
  groupYoungEventsByStartDate,
  youngCapacity,
  youngEventStatusLabel,
  youngListDayLabel,
  youngListTimeLabel,
} from "../lib/young-event-display";
import { youngDetailHref } from "../lib/young-navigation";
import { youngEventTableFields } from "../lib/young-table-filters";
import YoungFilterToolbar from "./YoungFilterToolbar.svelte";
import YoungSourceNote from "./YoungSourceNote.svelte";

type Props = {
  readOnly?: boolean;
  categories: string[];
  copy: AppPageCopy;
  data: YoungEventSummary[];
  tableFilters: Record<string, string>;
  organizers: Pick<YoungOrganizerSummary, "id" | "name">[];
  source: YoungSourceFreshness;
  endless: EndlessScrollState;
};

let {
  readOnly = false,
  categories,
  copy,
  data,
  tableFilters,
  organizers,
  endless,
  source,
}: Props = $props();

const youngCopy = $derived(copy.youngEvents);
const commonLabels = $derived(copy.common);

const descriptionParts = $derived(
  youngCopy.description.split(youngCopy.platformName),
);
const locale = $derived(appPage.data.locale === "en-us" ? "en-us" : "zh-cn");
const groups = $derived(
  groupYoungEventsByStartDate(data).map((group) => ({
    label: youngListDayLabel(group.key, locale, youngCopy.unknownTime),
    rows: group.events,
  })),
);
function listTime(event: YoungEventSummary) {
  return youngListTimeLabel(event.startAt, event.isActive, youngCopy);
}

function listStatus(event: YoungEventSummary) {
  return youngEventStatusLabel(event, youngCopy);
}
</script>

{#snippet metaBadges(event: YoungEventSummary)}
  <div class="mt-1 flex min-w-0 flex-wrap items-center gap-1.5" data-testid="young-list-metadata">
    {#each [event.category, event.module, event.activityLevel] as value}
      {#if value?.trim()}
        <Badge variant="outline" class="h-auto max-w-full whitespace-normal">{value}</Badge>
      {/if}
    {/each}
    {#if event.organizer}
      <span class="text-xs text-muted-foreground">{event.organizer}</span>
    {/if}
  </div>
{/snippet}

{#snippet statusBadge(event: YoungEventSummary)}
  <Badge
    data-status-token={resolveStatusToken({
      status: event.status,
      isActive: event.isActive,
    })}
    variant={`status-${resolveStatusToken(event)}`}
  >
    {listStatus(event)}
  </Badge>
{/snippet}

{#snippet paginationFooter()}
  <div class="grid w-full gap-3">
    <EndlessScroll state={endless} labels={commonLabels.endlessScroll} />
    <YoungSourceNote labels={youngCopy} source={source} />
  </div>
{/snippet}

{#snippet description()}
  <p class="mt-1 max-w-2xl text-muted-foreground">
    {#each descriptionParts as part, index (index)}
      {part}{#if index < descriptionParts.length - 1}{#if readOnly}<span>{youngCopy.platformName}</span>{:else}<a class="underline underline-offset-4" href="https://young.ustc.edu.cn" rel="noreferrer noopener" target="_blank">{youngCopy.platformName}</a>{/if}{/if}
    {/each}
  </p>
{/snippet}

<CollectionPage footer={paginationFooter} title={youngCopy.title}>
  {#snippet belowTitle()}
    {@render description()}
  {/snippet}
  <section class="grid min-w-0 gap-3">
    <YoungFilterToolbar
      {copy}
      id="young-event-filters"
      action="/catalog/young-events"
      placeholder={youngCopy.searchPlaceholder}
      applied={tableFilters}
      fieldsFor={values => youngEventTableFields(copy, categories, organizers, values.timeBasis, values.category)}
    />
    {#if data.length}
      <RecordCollection
        rows={data}
        {groups}
        href={row => youngDetailHref(row.youngId)}
        titleLabel={youngCopy.eventName}
        titleText={row => row.name}
        fields={[
          { label: youngCopy.eventTime, text: row => listTime(row) },
          { label: youngCopy.location, text: row => row.location ?? "" },
          { label: youngCopy.capacity, text: row => row.appliedCount != null && row.appliedCount > 0 ? youngCapacity(row.appliedCount, row.capacity, youngCopy.unknownValue) : "" },
          { label: youngCopy.status, content: statusBadge }
        ]}
      >
        {#snippet title(row)}{row.name}{@render metaBadges(row)}{/snippet}
      </RecordCollection>
    {:else}
      <CollectionEmpty variant={Object.values(tableFilters).some(Boolean) ? "filter-clear" : "browse"} clearFilterLabel={commonLabels.clear} clearHref="/catalog/young-events" description={youngCopy.description} title={youngCopy.noEventsFound} />
    {/if}

  </section>
</CollectionPage>
