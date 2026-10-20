<script lang="ts">
import { onMount } from "svelte";
import Panel from "#lib/components/Panel.svelte";
import RenderedMarkdown from "#lib/components/RenderedMarkdown.svelte";
import * as Alert from "#lib/components/ui/alert/index.js";
import { Badge } from "#lib/components/ui/badge/index.js";
import { Button } from "#lib/components/ui/button/index.js";
import { Skeleton } from "#lib/components/ui/skeleton/index.js";
import { resolveStatusToken } from "#lib/ui/action-status-tokens.js";
import { cn } from "#lib/utils.js";
import type { CommentsInitialData } from "@/features/comments/lib/comment-panel-data";
import { commentTargetPermalinkBaseHref } from "@/features/comments/lib/comment-panel-links";
import type {
  YoungEventDetail,
  YoungSourceFreshness,
} from "@/features/young/server/young-event-service";
import type { AppPageCopy } from "@/lib/shell/page-copy";
import {
  youngCapacity,
  youngDateRange,
  youngDateTime,
  youngDetailFacts,
  youngEventStatusLabel,
} from "../lib/young-event-display";
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
const statusLabel = $derived(
  youngEventStatusLabel(event, {
    statusOpen: youngCopy.statusOpen,
    statusClosed: youngCopy.statusClosed,
  }),
);
const statusToken = $derived(
  resolveStatusToken({
    status: event.status,
    isActive: event.isActive,
  }),
);
const placeLabel = $derived(
  event.location ??
    event.places
      ?.map((place) => place.placeInfo)
      .filter(Boolean)
      .join(" · ") ??
    null,
);
const capacityLabel = $derived(
  event.appliedCount != null || event.capacity != null
    ? youngCapacity(event.appliedCount, event.capacity, youngCopy.unknownValue)
    : null,
);
const deadlineLabel = $derived(
  event.requiresSignup === false
    ? youngCopy.signupNotRequired
    : youngDateTime(event.applyEndAt),
);
const facts = $derived(
  youngDetailFacts({
    time: youngDateRange(event.startAt, event.endAt, youngCopy),
    place: placeLabel,
    hours: event.hours == null ? null : `${event.hours} ${youngCopy.hours}`,
    capacity:
      capacityLabel == null ? null : `${youngCopy.capacity}: ${capacityLabel}`,
    deadline:
      deadlineLabel == null
        ? null
        : event.requiresSignup === false
          ? deadlineLabel
          : `${youngCopy.signupDeadline}: ${deadlineLabel}`,
  }),
);
const signupHref = "https://young.ustc.edu.cn";
const signupLabel = $derived(
  event.requiresSignup === false || !event.isActive
    ? youngCopy.viewOfficial
    : youngCopy.signupCta,
);
</script>

<div class="page-frame page-frame-content px-4 py-6 sm:px-5 lg:px-6">
  <header
    class={cn("grid min-w-0 gap-6 lg:items-start", event.imageUrl && "lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]")}
    data-testid="young-event-banner"
  >
    {#if event.imageUrl}
      <a
        class="justify-self-center lg:justify-self-stretch"
        href={event.imageUrl}
        rel="noreferrer noopener"
        target="_blank"
        aria-label={youngCopy.poster}
      >
        <img
          alt={event.name}
          class="max-h-64 w-full rounded-lg bg-muted object-contain lg:max-h-80"
          onerror={hideBrokenImage}
          src={event.imageUrl}
        />
      </a>
    {/if}
    <div class="grid min-w-0 gap-4">
      <div class="grid min-w-0 gap-3">
        <h1 class="text-3xl font-semibold tracking-normal sm:text-4xl">
          {event.name}
        </h1>
        <div class="flex min-w-0 flex-wrap gap-2" data-testid="young-event-badges">
          <Badge
            data-status-token={statusToken}
            variant={`status-${statusToken}`}
          >
            {statusLabel}
          </Badge>
          {#each badges as badge (badge)}
            <Badge variant="outline">{badge}</Badge>
          {/each}
        </div>
        {#if facts.length > 0}
          <p
            class="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground [overflow-wrap:anywhere]"
            data-testid="young-event-overview"
          >
            {#each facts as fact, index (index)}
              {#if index > 0}<span aria-hidden="true"> · </span>{/if}<span
                >{fact}</span
              >
            {/each}
          </p>
        {/if}
      </div>
      <div class="flex flex-wrap items-center gap-3">
        <Button
          href={signupHref}
          rel="noreferrer noopener"
          target="_blank"
          data-testid="young-event-signup"
        >
          {signupLabel}
        </Button>
        <YoungSubscriptionControl
          compact
          id={event.youngId}
          copy={youngCopy.workspace}
        />
      </div>
      <p class="text-sm text-muted-foreground">{youngCopy.signupHint}</p>
    </div>
  </header>

  <div class="mt-8 grid min-w-0 gap-8">
    {#if event.description}
      <Panel>
        {#snippet header()}
          <h2 class="text-lg font-semibold tracking-tight">
            {youngCopy.sectionDescription}
          </h2>
        {/snippet}
        <div class="young-event-copy" onerrorcapture={hideBrokenImage}>
          <RenderedMarkdown html={event.description} />
        </div>
      </Panel>
    {/if}
    {#if event.participationNotes}
      <Panel>
        {#snippet header()}
          <h2 class="text-lg font-semibold tracking-tight">
            {youngCopy.sectionNotes}
          </h2>
        {/snippet}
        <div class="young-event-copy" onerrorcapture={hideBrokenImage}>
          <RenderedMarkdown html={event.participationNotes} />
        </div>
      </Panel>
    {/if}
    {#if event.sourceMissing}
      <Alert.Root
        ><Alert.Description>{youngCopy.sourceMissing}</Alert.Description
        ></Alert.Root
      >
    {/if}
    <YoungSourceNote
      labels={youngCopy}
      missing={event.sourceMissing ? youngCopy.sourceMissing : null}
      {source}
    />
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
              <Button
                size="sm"
                variant="ghost"
                onclick={() => void loadDetailModules()}
              >
                {copy.comments.retry}
              </Button>
            </Alert.Action>
          </Alert.Root>
        {:else if detailModulesLoading}
          <div
            class="grid gap-3"
            aria-busy="true"
            aria-label={copy.comments.title}
          >
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
