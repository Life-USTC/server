<script lang="ts">
import { onMount } from "svelte";
import type { CommentsInitialData } from "@/features/comments/lib/comment-panel-data";
import { commentTargetPermalinkBaseHref } from "@/features/comments/lib/comment-panel-links";
import type {
  YoungEventDetail,
  YoungSourceFreshness,
} from "@/features/young/server/young-event-service";
import type { AppPageCopy } from "@/lib/shell/page-copy";
import { page } from "$app/stores";
import DetailDefinitionList from "$lib/components/DetailDefinitionList.svelte";
import { detailColumnsClass } from "$lib/components/detail-layout";
import Panel from "$lib/components/Panel.svelte";
import RenderedMarkdown from "$lib/components/RenderedMarkdown.svelte";
import * as Alert from "$lib/components/ui/alert/index.js";
import { Badge } from "$lib/components/ui/badge/index.js";
import { buttonVariants } from "$lib/components/ui/button";
import { Button } from "$lib/components/ui/button/index.js";
import * as Collapsible from "$lib/components/ui/collapsible";
import { Skeleton } from "$lib/components/ui/skeleton/index.js";
import { cn } from "$lib/utils.js";
import { youngDateRange, youngDateTime } from "../lib/young-event-display";
import { youngReturnHref } from "../lib/young-navigation";
import YoungSourceNote from "./YoungSourceNote.svelte";
import YoungSubscriptionControl from "./YoungSubscriptionControl.svelte";

type Props = {
  commentsData?: CommentsInitialData | null;
  copy: AppPageCopy;
  event: YoungEventDetail;
  source: YoungSourceFreshness;
};

let { commentsData = null, copy, event, source }: Props = $props();

let CommentsPanel = $state<
  | typeof import("@/features/comments/components/CommentsPanel.svelte").default
  | null
>(null);
let commentsLoadError = $state(false);
let detailModulesLoading = $state(true);

async function loadDetailModules() {
  detailModulesLoading = true;
  commentsLoadError = false;
  try {
    const result = await import(
      "@/features/comments/components/CommentsPanel.svelte"
    );
    CommentsPanel = result.default;
  } catch {
    commentsLoadError = true;
  } finally {
    detailModulesLoading = false;
  }
}

onMount(() => {
  void loadDetailModules();
});

const youngCopy = $derived(copy.youngEvents);
const returnHref = $derived(
  youngReturnHref($page.url.searchParams.get("returnTo")),
);
const returnLabel = $derived(
  returnHref.includes("/calendar")
    ? youngCopy.backToCalendar
    : returnHref.includes("/organizers")
      ? youngCopy.backToOrganizers
      : youngCopy.backToList,
);
const overviewFields = $derived([
  {
    label: youngCopy.eventTime,
    value: formatRange(event.startAt, event.endAt) ?? youngCopy.unknownTime,
  },
  {
    label: youngCopy.location,
    value:
      event.location ??
      (event.places
        ?.map((place) => place.placeInfo)
        .filter(Boolean)
        .join(" · ") ||
        youngCopy.unknownValue),
  },
  {
    label: youngCopy.hours,
    value: event.hours == null ? youngCopy.unknownValue : String(event.hours),
  },
  {
    label: youngCopy.signupDeadline,
    value:
      event.requiresSignup === false
        ? youngCopy.signupNotRequired
        : (formatDateTime(event.applyEndAt) ?? youngCopy.unknownTime),
  },
]);

function formatDateTime(value: string | null) {
  return youngDateTime(value);
}

function formatRange(start: string | null, end: string | null) {
  return youngDateRange(start, end, youngCopy);
}

type Field = { label: string; value: string | null | undefined };

function fieldList(fields: Field[]) {
  return fields.filter(
    (field) => field.value != null && field.value !== "",
  ) as Array<{ label: string; value: string }>;
}

function numberValue(value: number | null) {
  return value == null ? null : String(value);
}

function placeRange(start: string | null, end: string | null) {
  return youngDateRange(start, end, youngCopy);
}

const badges = $derived(
  [
    ...new Set([
      event.activityLevel,
      event.module,
      event.form,
      event.isOnline === true ? youngCopy.online : null,
    ]),
  ].filter((value): value is string => value != null && value !== ""),
);

const recordFields = $derived(
  fieldList([
    {
      label: youngCopy.createdAtUpstream,
      value: formatDateTime(event.createdAtUpstream),
    },
    { label: youngCopy.auditedAt, value: formatDateTime(event.auditedAt) },
    {
      label: youngCopy.updatedAtUpstream,
      value: formatDateTime(event.updatedAtUpstream),
    },
  ]),
);

const peopleFields = $derived(
  fieldList([
    { label: youngCopy.partakeNum, value: numberValue(event.partakeNum) },
    { label: youngCopy.sumPersons, value: numberValue(event.sumPersons) },
    { label: youngCopy.hours, value: numberValue(event.hours) },
    { label: youngCopy.sumHours, value: numberValue(event.sumHours) },
    { label: youngCopy.serviceHour, value: numberValue(event.serviceHour) },
    {
      label: youngCopy.duration,
      value:
        event.duration == null
          ? null
          : youngCopy.durationHours.replace("{value}", String(event.duration)),
    },
  ]),
);

const places = $derived(
  (event.places ?? [])
    .map((place) => ({
      info: place.placeInfo,
      range: placeRange(place.placeSt, place.placeEt),
    }))
    .filter((place) => place.info != null || place.range != null),
);

const extraPlaces = $derived.by(() => {
  const shownLocation =
    event.location?.trim() ||
    places
      .map((place) => place.info)
      .filter((info): info is string => Boolean(info))
      .join(" · ");
  const eventRange = formatRange(event.startAt, event.endAt);
  return places.filter((place) => {
    const infoShown = !place.info || shownLocation.includes(place.info);
    const rangeShown = !place.range || place.range === eventRange;
    return !(infoShown && rangeShown);
  });
});
</script>

{#snippet factSection(title: string, fields: { label: string; value: string }[])}
  {#if fields.length > 0}
    <section class="grid gap-3">
      <h2 class="text-sm font-semibold tracking-tight">{title}</h2>
      <DetailDefinitionList items={fields} />
    </section>
  {/if}
{/snippet}

<div>
  <header class="relative isolate overflow-hidden bg-muted" data-testid="young-event-banner">
    {#if event.imageUrl}
      <a class="absolute inset-0" href={event.imageUrl} rel="noreferrer noopener" target="_blank" aria-label={youngCopy.poster}>
        <img alt="" class="h-full w-full object-cover" src={event.imageUrl} />
      </a>
    {/if}
    <div class="pointer-events-none absolute inset-0 bg-[linear-gradient(to_top,white_0%,white_28%,transparent_72%)] dark:bg-[linear-gradient(to_top,black_0%,black_28%,transparent_72%)]"></div>
    <div class="relative flex h-64 items-end px-4 pb-6 sm:h-80 sm:px-5 lg:h-96 lg:px-6">
      <h1 class="max-w-4xl text-3xl font-semibold tracking-normal text-foreground sm:text-4xl">{event.name}</h1>
    </div>
  </header>
  <div class={cn("page-frame page-frame-content px-4 py-6 sm:px-5 lg:px-6", detailColumnsClass)}>
    <div class="grid min-w-0 gap-10">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex min-w-0 flex-wrap gap-2" data-testid="young-event-badges">
          <Badge variant={event.isActive ? "default" : "outline"}>{event.status ?? (event.isActive ? youngCopy.statusActive : youngCopy.statusEnded)}</Badge>
          {#each badges as badge (badge)}
            <Badge variant="secondary">{badge}</Badge>
          {/each}
        </div>
        <Button href={returnHref} variant="outline">{returnLabel}</Button>
      </div>

  {#if event.description}
    <Panel>
      {#snippet header()}
        <h2 class="text-lg font-semibold tracking-tight">{youngCopy.sectionDescription}</h2>
      {/snippet}
      <div class="young-event-copy">
        <RenderedMarkdown html={event.description} />
      </div>
    </Panel>
  {/if}
  {#if event.participationNotes}
    <Panel>
      {#snippet header()}
        <h2 class="text-lg font-semibold tracking-tight">{youngCopy.sectionNotes}</h2>
      {/snippet}
      <div class="young-event-copy">
        <RenderedMarkdown html={event.participationNotes} />
      </div>
    </Panel>
  {/if}
  {#if peopleFields.length || recordFields.length}
    <Collapsible.Root class="grid gap-3">
      <Collapsible.Trigger class={buttonVariants({ variant: "outline", class: "justify-self-start" })}>{youngCopy.moreDetails}</Collapsible.Trigger>
      <Collapsible.Content class="grid gap-5">
        {@render factSection(youngCopy.sectionPeople, peopleFields)}
        {@render factSection(youngCopy.sectionRecord, recordFields)}
      </Collapsible.Content>
    </Collapsible.Root>
  {/if}
  <section id="comments" class="scroll-mt-4">
    {#key `comments:young-event:${event.youngId}`}
      {#if CommentsPanel}
        <CommentsPanel
          heading={copy.comments.title}
          initialData={commentsData}
          permalinkBaseHref={commentTargetPermalinkBaseHref({
            type: "young-event",
            youngId: event.youngId,
          })}
          targetType="young-event"
          youngId={event.youngId}
        />
      {:else if commentsLoadError}
        <Alert.Root variant="destructive">
          <Alert.Description>{copy.comments.loadFailed}</Alert.Description>
          <Alert.Action>
            <Button size="sm" variant="ghost" onclick={() => void loadDetailModules()}>
              {copy.comments.retry}
            </Button>
          </Alert.Action>
        </Alert.Root>
      {:else if detailModulesLoading}
        <div class="grid gap-3" aria-busy="true" aria-label={copy.comments.title}>
          <Skeleton class="h-5 w-24" />
          <Skeleton class="h-16 w-full" />
        </div>
      {/if}
    {/key}
  </section>
    </div>
    <aside class="grid min-w-0 content-start gap-6 lg:sticky lg:top-4">
    <Panel>
      {#snippet header()}<h2 class="text-lg font-semibold tracking-tight">{youngCopy.activitySummary}</h2>{/snippet}
      <div data-testid="young-event-overview">
        <DetailDefinitionList items={overviewFields} />
      </div>
      {#if extraPlaces.length > 0}
        <section class="mt-5 grid gap-3">
          <h2 class="text-sm font-semibold tracking-tight">{youngCopy.sectionPlaces}</h2>
          <ul class="grid gap-3">
            {#each extraPlaces as place, index (index)}
              <li class="grid gap-1">
                {#if place.info}<span class="text-sm font-medium">{place.info}</span>{/if}
                {#if place.range}<span class="text-muted-foreground text-sm">{place.range}</span>{/if}
              </li>
            {/each}
          </ul>
        </section>
      {/if}
      {#if event.sourceMissing}
        <Alert.Root class="mt-4"><Alert.Description>{youngCopy.sourceMissing}</Alert.Description></Alert.Root>
      {/if}
      <div class="mt-5 grid gap-3">
        <Button class="justify-self-start" href="https://young.ustc.edu.cn" rel="noreferrer noopener" target="_blank">{event.requiresSignup === false || !event.isActive ? youngCopy.viewOfficial : youngCopy.signupCta}</Button>
        <p class="text-sm text-muted-foreground">{youngCopy.signupHint}</p>
        <YoungSubscriptionControl id={event.youngId} copy={youngCopy.workspace} />
      </div>
    </Panel>
    <YoungSourceNote labels={youngCopy} {source} />
    </aside>
  </div>
</div>

<style>
  .young-event-copy :global(img) {
    background: var(--muted);
    display: block;
    height: auto !important;
    margin: 0.75rem auto;
    max-height: 18rem;
    max-width: min(100%, 24rem);
    object-fit: contain;
    width: auto !important;
  }
</style>
