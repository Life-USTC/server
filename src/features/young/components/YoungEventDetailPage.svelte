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
import Panel from "$lib/components/Panel.svelte";
import RenderedMarkdown from "$lib/components/RenderedMarkdown.svelte";
import * as Alert from "$lib/components/ui/alert/index.js";
import { Badge } from "$lib/components/ui/badge/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import { Skeleton } from "$lib/components/ui/skeleton/index.js";
import { youngReturnHref } from "../lib/young-navigation";
import YoungSourceNote from "./YoungSourceNote.svelte";

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
        <img alt="" class="h-full w-full object-cover" src={event.imageUrl} />
      </a>
    {/if}
    <div class="pointer-events-none absolute inset-0 bg-[linear-gradient(to_top,white_0%,white_28%,transparent_72%)] dark:bg-[linear-gradient(to_top,black_0%,black_28%,transparent_72%)]"></div>
    <div class="relative flex h-64 flex-col justify-end gap-3 px-4 pb-6 sm:h-80 sm:px-5 lg:h-96 lg:px-6">
      <h1 class="max-w-4xl text-3xl font-semibold tracking-normal text-foreground sm:text-4xl">{event.name}</h1>
      <div class="flex min-w-0 flex-wrap gap-2" data-testid="young-event-badges">
        <Badge variant={event.isActive ? "default" : "outline"}>{event.status ?? (event.isActive ? youngCopy.statusActive : youngCopy.statusEnded)}</Badge>
        {#each badges as badge (badge)}
          <Badge variant="secondary">{badge}</Badge>
        {/each}
      </div>
    </div>
  </header>
  <div class="grid min-w-0 gap-8 px-4 py-6 sm:px-5 lg:px-6">
    <div>
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
  {#if event.sourceMissing}
    <Alert.Root><Alert.Description>{youngCopy.sourceMissing}</Alert.Description></Alert.Root>
  {/if}
  <YoungSourceNote labels={youngCopy} {source} />
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
