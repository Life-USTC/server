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
import PageHeader from "$lib/components/PageHeader.svelte";
import PageLayout from "$lib/components/PageLayout.svelte";
import Panel from "$lib/components/Panel.svelte";
import RenderedMarkdown from "$lib/components/RenderedMarkdown.svelte";
import * as Alert from "$lib/components/ui/alert/index.js";
import { Badge } from "$lib/components/ui/badge/index.js";
import { buttonVariants } from "$lib/components/ui/button";
import { Button } from "$lib/components/ui/button/index.js";
import * as Collapsible from "$lib/components/ui/collapsible";
import { Skeleton } from "$lib/components/ui/skeleton/index.js";
import { youngDateRange, youngDateTime } from "../lib/young-event-display";
import { youngReturnHref } from "../lib/young-navigation";
import YoungBrowseNav from "./YoungBrowseNav.svelte";
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

function formatSourceDate(value: string | null) {
  return youngDateTime(value);
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

const timeFields = $derived(
  fieldList([
    {
      label: youngCopy.eventTime,
      value: formatRange(event.startAt, event.endAt),
    },
    {
      label: youngCopy.signupWindow,
      value: formatRange(event.applyStartAt, event.applyEndAt),
    },
  ]),
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

const registrationFields = $derived(
  fieldList([
    {
      label: youngCopy.signupRequirement,
      value:
        event.requiresSignup === true
          ? youngCopy.signupRequired
          : event.requiresSignup === false
            ? youngCopy.signupNotRequired
            : null,
    },
    { label: youngCopy.appliedCount, value: numberValue(event.appliedCount) },
    { label: youngCopy.capacity, value: numberValue(event.capacity) },
    { label: youngCopy.grades, value: event.grades },
    {
      label: youngCopy.allowedAttachmentTypes,
      value: event.allowedAttachmentTypes.join(", ").toUpperCase(),
    },
    {
      label: youngCopy.onlineMeetingInfo,
      value: event.isOnline === false ? null : event.onlineMeetingInfo,
    },
  ]),
);

const peopleFields = $derived(
  fieldList([
    { label: youngCopy.limitNum, value: numberValue(event.limitNum) },
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
    { label: youngCopy.favCount, value: numberValue(event.favCount) },
  ]),
);

const organizationFields = $derived(
  fieldList([
    { label: youngCopy.category, value: event.category },
    { label: youngCopy.sponsor, value: event.sponsor },
    { label: youngCopy.externalSponsor, value: event.externalSponsor },
    { label: youngCopy.organizer, value: event.organizer },
    { label: youngCopy.department, value: event.department },
    { label: youngCopy.contactName, value: event.contactName },
    { label: youngCopy.contactTel, value: event.contactTel },
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
</script>

<PageLayout>
  {#snippet header()}<PageHeader title={event.name} description={event.category ?? youngCopy.description} />{/snippet}
  <YoungBrowseNav current="events" copy={youngCopy} />
  <Button href={returnHref} variant="link">{returnLabel}</Button>
  <div class="grid gap-5">

      <div class="flex flex-wrap gap-2" data-testid="young-event-badges">
        <Badge variant={event.isActive ? "default" : "outline"}>{event.status ?? (event.isActive ? youngCopy.statusActive : youngCopy.statusEnded)}</Badge>
        {#each badges as badge (badge)}
          <Badge variant="secondary">{badge}</Badge>
        {/each}
      </div>

    {#snippet fieldSection(title: string, fields: { label: string; value: string }[])}
      {#if fields.length > 0}
        <Panel>
          {#snippet header()}
            <h2 class="text-lg font-semibold tracking-tight">{title}</h2>
          {/snippet}
          <dl class="grid gap-4 sm:grid-cols-2">
            {#each fields as field (field.label)}
              <div class="grid gap-1">
                <dt class="text-muted-foreground text-sm">{field.label}</dt>
                <dd class="break-words text-sm font-medium">{field.value}</dd>
              </div>
            {/each}
          </dl>
        </Panel>
      {/if}
    {/snippet}

    {#if event.organizerId && event.organizer}
      <p class="text-sm">
        <span class="text-muted-foreground">{youngCopy.organizer}: </span>
        <a
          class="underline underline-offset-4"
          href={`/catalog/young-events/organizers/${event.organizerId}`}
        >
          {event.organizer}
        </a>
      </p>
    {/if}

    <Panel>
      {#snippet header()}<h2 class="text-lg font-semibold tracking-tight">{youngCopy.activitySummary}</h2>{/snippet}
      <dl class="grid gap-4 sm:grid-cols-2" data-testid="young-event-overview">
        {#each overviewFields as field (field.label)}
          <div class="grid gap-1"><dt class="text-sm text-muted-foreground">{field.label}</dt><dd class="text-sm font-medium">{field.value}</dd></div>
        {/each}
      </dl>
      {#if event.sourceMissing}
        <Alert.Root class="mt-4"><Alert.Description>{youngCopy.sourceMissing}</Alert.Description></Alert.Root>
      {/if}
      <div class="mt-5 grid gap-3">
        <Button class="justify-self-start" href="https://young.ustc.edu.cn" rel="noreferrer noopener" target="_blank">{event.requiresSignup === false || !event.isActive ? youngCopy.viewOfficial : youngCopy.signupCta}</Button>
        <p class="text-sm text-muted-foreground">{youngCopy.signupHint}</p>
        <YoungSubscriptionControl id={event.youngId} copy={youngCopy.workspace} />
      </div>
    </Panel>

    {#if event.imageUrl}
      <Collapsible.Root class="grid gap-3">
        <Collapsible.Trigger class={buttonVariants({ variant: "ghost", class: "justify-self-start" })}>{youngCopy.poster}</Collapsible.Trigger>
        <Collapsible.Content><img alt={event.name} class="max-h-96 w-full rounded-lg object-contain" src={event.imageUrl} /></Collapsible.Content>
      </Collapsible.Root>
    {/if}
    {#if event.description}
      <Panel>
        {#snippet header()}
          <h2 class="text-lg font-semibold tracking-tight">
            {youngCopy.sectionDescription}
          </h2>
        {/snippet}
        <RenderedMarkdown html={event.description} />
      </Panel>
    {/if}

    {@render fieldSection(youngCopy.sectionTime, timeFields)}
    {@render fieldSection(youngCopy.sectionRegistration, registrationFields)}
    {#if event.requiresSignupInfo != null}
      <p class="text-sm text-muted-foreground">{event.requiresSignupInfo ? youngCopy.signupInfoRequired : youngCopy.signupInfoNotRequired}</p>
    {/if}
    {#if event.signupScopeCode != null || event.signupDepartmentIds.length > 0}
      <p class="text-sm text-muted-foreground">{youngCopy.scopeHint}</p>
    {/if}

    {@render fieldSection(youngCopy.sectionOrganization, organizationFields)}

    {#if places.length > 0 || event.location}
      <Panel>
        {#snippet header()}
          <h2 class="text-lg font-semibold tracking-tight">
            {youngCopy.sectionPlaces}
          </h2>
        {/snippet}
        {#if places.length > 0}
          <ul class="grid gap-3">
            {#each places as place, index (index)}
              <li class="grid gap-1">
                {#if place.info}<span class="text-sm font-medium">{place.info}</span>{/if}
                {#if place.range}
                  <span class="text-muted-foreground text-sm">{place.range}</span>
                {/if}
              </li>
            {/each}
          </ul>
        {:else}
          <dl class="grid gap-1">
            <dt class="text-muted-foreground text-sm">{youngCopy.location}</dt>
            <dd class="break-words text-sm font-medium">{event.location}</dd>
          </dl>
        {/if}
      </Panel>
    {/if}

    {#if event.participationNotes}
      <Panel>
        {#snippet header()}
          <h2 class="text-lg font-semibold tracking-tight">
            {youngCopy.sectionNotes}
          </h2>
        {/snippet}
        <RenderedMarkdown html={event.participationNotes} />
      </Panel>
    {/if}

    {#if peopleFields.length || recordFields.length}
    <Collapsible.Root class="grid gap-3">
      <Collapsible.Trigger class={buttonVariants({ variant: "outline", class: "justify-self-start" })}>{youngCopy.moreDetails}</Collapsible.Trigger>
      <Collapsible.Content class="grid gap-5">
        {@render fieldSection(youngCopy.sectionPeople, peopleFields)}
        {@render fieldSection(youngCopy.sectionRecord, recordFields)}
      </Collapsible.Content>
    </Collapsible.Root>
    {/if}
    <div
      class="flex flex-wrap items-center justify-between gap-3 text-sm"
      data-testid="young-source-freshness"
    >
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
      {#if event.sourceMissing}
        <span class="text-muted-foreground">{youngCopy.sourceMissing}</span>
      {/if}
    </div>

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
</PageLayout>
