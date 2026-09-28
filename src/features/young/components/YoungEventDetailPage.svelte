<script lang="ts">
import { onMount } from "svelte";
import type { CommentsInitialData } from "@/features/comments/lib/comment-panel-data";
import { commentTargetPermalinkBaseHref } from "@/features/comments/lib/comment-panel-links";
import type {
  YoungEventDetail,
  YoungSourceFreshness,
} from "@/features/young/server/young-event-service";
import type { AppPageCopy } from "@/lib/shell/page-copy";
import DetailDefinitionList from "$lib/components/DetailDefinitionList.svelte";
import Panel from "$lib/components/Panel.svelte";
import RenderedMarkdown from "$lib/components/RenderedMarkdown.svelte";
import * as Alert from "$lib/components/ui/alert/index.js";
import { Badge } from "$lib/components/ui/badge/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import { Skeleton } from "$lib/components/ui/skeleton/index.js";
import { youngDateRange, youngDateTime } from "../lib/young-event-display";
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

function hideBrokenImage(event: Event) {
  const target = event.target;
  if (target instanceof HTMLImageElement) target.hidden = true;
}

const youngCopy = $derived(copy.youngEvents);
type Field = { label: string; value: string | null | undefined };

function fieldList(fields: Field[]) {
  return fields.filter(
    (field) => field.value != null && field.value !== "",
  ) as Array<{ label: string; value: string }>;
}

function numberValue(value: number | null) {
  return value == null ? null : String(value);
}

function fullRange(start: string | null, end: string | null) {
  const from = youngDateTime(start);
  const to = youngDateTime(end);
  if (from && to) return `${from} – ${to}`;
  return youngDateRange(start, end, youngCopy);
}

const timeFields = $derived(
  fieldList([
    {
      label: youngCopy.eventTime,
      value: fullRange(event.startAt, event.endAt),
    },
    {
      label: youngCopy.signupWindow,
      value: fullRange(event.applyStartAt, event.applyEndAt),
    },
  ]),
);
const recordFields = $derived(
  fieldList([
    {
      label: youngCopy.createdAtUpstream,
      value: youngDateTime(event.createdAtUpstream),
    },
    { label: youngCopy.auditedAt, value: youngDateTime(event.auditedAt) },
    {
      label: youngCopy.updatedAtUpstream,
      value: youngDateTime(event.updatedAtUpstream),
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
    { label: youngCopy.location, value: event.location },
  ]),
);
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
</script>

<div>
  <header class="relative isolate overflow-hidden bg-muted" data-testid="young-event-banner">
    {#if event.imageUrl}
      <a class="absolute inset-0" href={event.imageUrl} rel="noreferrer noopener" target="_blank" aria-label={youngCopy.poster}>
        <img alt={event.name} class="h-full w-full object-cover" onerror={hideBrokenImage} src={event.imageUrl} />
      </a>
    {/if}
    <div class="pointer-events-none absolute inset-0 bg-[linear-gradient(to_top,white_0%,white_28%,transparent_72%)] dark:bg-[linear-gradient(to_top,black_0%,black_28%,transparent_72%)]"></div>
    <div class="relative z-10 flex h-64 flex-col justify-end gap-3 px-4 pb-6 sm:h-80 sm:px-5 lg:h-96 lg:px-6">
      <div class="flex items-center justify-between gap-4">
        <h1 class="min-w-0 flex-1 text-3xl font-semibold tracking-normal text-foreground sm:text-4xl">{event.name}</h1>
        <YoungSubscriptionControl compact id={event.youngId} copy={youngCopy.workspace} />
      </div>
      <div class="flex min-w-0 flex-wrap gap-2" data-testid="young-event-badges">
        <Badge variant={event.isActive ? "default" : "outline"}>{event.status ?? (event.isActive ? youngCopy.statusActive : youngCopy.statusEnded)}</Badge>
        {#each badges as badge (badge)}
          <Badge variant="secondary">{badge}</Badge>
        {/each}
      </div>
    </div>
  </header>
  <div class="grid min-w-0 gap-8 px-4 py-6 sm:px-5 lg:px-6">
  {#if event.description}
    <Panel>
      {#snippet header()}
        <h2 class="text-lg font-semibold tracking-tight">{youngCopy.sectionDescription}</h2>
      {/snippet}
      <div class="young-event-copy" onerrorcapture={hideBrokenImage}>
        <RenderedMarkdown html={event.description} />
      </div>
    </Panel>
  {/if}
  {#if event.participationNotes}
    <Panel>
      {#snippet header()}
        <h2 class="text-lg font-semibold tracking-tight">{youngCopy.sectionNotes}</h2>
      {/snippet}
      <div class="young-event-copy" onerrorcapture={hideBrokenImage}>
        <RenderedMarkdown html={event.participationNotes} />
      </div>
    </Panel>
  {/if}
  {#if event.sourceMissing}
    <Alert.Root><Alert.Description>{youngCopy.sourceMissing}</Alert.Description></Alert.Root>
  {/if}
  {#snippet facts(title: string, items: { label: string; value: string }[])}
    {#if items.length > 0}
      <section class="grid gap-3">
        <h2 class="text-sm font-semibold tracking-tight">{title}</h2>
        <DetailDefinitionList {items} />
      </section>
    {/if}
  {/snippet}
  {@render facts(youngCopy.sectionTime, timeFields)}
  {@render facts(youngCopy.sectionRegistration, registrationFields)}
  {@render facts(youngCopy.sectionPeople, peopleFields)}
  {@render facts(youngCopy.sectionOrganization, organizationFields)}
  {@render facts(youngCopy.sectionRecord, recordFields)}
  {#if event.places && event.places.length > 0}
    <section class="grid gap-3">
      <h2 class="text-sm font-semibold tracking-tight">{youngCopy.sectionPlaces}</h2>
      <ul class="grid gap-2">
        {#each event.places as place, index (index)}
          {#if place.placeInfo}<li class="text-sm">{place.placeInfo}</li>{/if}
        {/each}
      </ul>
    </section>
  {/if}
  {#if event.requiresSignupInfo != null}
    <p class="text-sm text-muted-foreground">{event.requiresSignupInfo ? youngCopy.signupInfoRequired : youngCopy.signupInfoNotRequired}</p>
  {/if}
  <YoungSourceNote labels={youngCopy} missing={event.sourceMissing ? youngCopy.sourceMissing : null} {source} />
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
