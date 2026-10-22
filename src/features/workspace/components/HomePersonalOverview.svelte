<script lang="ts">
import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
import { Button } from "#lib/components/ui/button/index.js";
import * as Item from "#lib/components/ui/item/index.js";
import { Skeleton } from "#lib/components/ui/skeleton/index.js";
import { getShellViewer } from "#lib/shell/shell-viewer.js";
import { browser } from "$app/env";

/**
 * The viewer's own overview on `/`.
 *
 * `/` is cached and its server load is viewer-independent, so this band cannot
 * be server-rendered: it reads the compact overview from the existing
 * `/api/workspace/overview` endpoint once the shell has resolved the viewer on
 * the client. A signed-in landing is therefore a cached shell plus one async
 * fetch rather than the full workspace SSR it used to be.
 *
 * The band reserves its own height while loading and keeps that height when the
 * data lands, so the campus information and directory below it do not jump.
 */
type CompactOverview = {
  counts: {
    todaySchedules: number;
    pendingHomeworks: number;
    upcomingExams: number;
    todos: { pending: number };
  };
};

let {
  copy,
  snapshotAt = null,
}: {
  copy: {
    failed: string;
    retry: string;
    title: string;
    counts: {
      todaySchedules: string;
      pendingHomeworks: string;
      pendingTodos: string;
      upcomingExams: string;
    };
    viewAll: string;
  };
  /** Mirrors the workspace `?snapshotAt=` deep link onto the API's `atTime`. */
  snapshotAt?: string | null;
} = $props();

const shellViewer = getShellViewer();
const viewer = $derived($shellViewer.viewer);

let overview = $state<CompactOverview | null>(null);
let failed = $state(false);
let loadedFor = $state("");
let controller: AbortController | undefined;

async function load(ownerId: string, atTime: string | null) {
  controller?.abort();
  const current = new AbortController();
  controller = current;
  failed = false;
  try {
    const query = new URLSearchParams();
    if (atTime) query.set("atTime", atTime);
    const search = query.toString();
    const response = await fetch(
      `/api/workspace/overview${search ? `?${search}` : ""}`,
      { headers: { accept: "application/json" }, signal: current.signal },
    );
    if (!response.ok) throw new Error(`overview ${response.status}`);
    const body = (await response.json()) as CompactOverview;
    if (current.signal.aborted) return;
    // A viewer change between request and response must not show the previous
    // owner's counts.
    if ($shellViewer.viewer?.id !== ownerId) return;
    overview = body;
  } catch {
    if (!current.signal.aborted && $shellViewer.viewer?.id === ownerId) {
      failed = true;
    }
  }
}

$effect(() => {
  const ownerId = viewer?.id;
  if (!browser || !ownerId) {
    if (!ownerId) {
      overview = null;
      loadedFor = "";
    }
    return;
  }
  const key = `${ownerId}:${snapshotAt ?? ""}`;
  if (key === loadedFor) return;
  loadedFor = key;
  overview = null;
  void load(ownerId, snapshotAt);
});

const tiles = $derived(
  overview
    ? ([
        {
          href: "/workspace/calendar",
          label: copy.counts.todaySchedules,
          value: overview.counts.todaySchedules,
        },
        {
          href: "/workspace/homeworks",
          label: copy.counts.pendingHomeworks,
          value: overview.counts.pendingHomeworks,
        },
        {
          href: "/workspace/todos",
          label: copy.counts.pendingTodos,
          value: overview.counts.todos.pending,
        },
        {
          href: "/workspace/exams",
          label: copy.counts.upcomingExams,
          value: overview.counts.upcomingExams,
        },
      ] as const)
    : [],
);
</script>

<!--
  Rendered only once the shell knows there is a viewer, so an anonymous visitor
  never pays a band of skeletons for content they will not get.
-->
{#if $shellViewer.status === "loading" || viewer}
  <!--
    `aria-busy` rather than a live region, matching the shell's viewer
    skeletons: a background refresh must not re-announce the band.
  -->
  <section
    aria-busy={!overview && !failed}
    class="grid min-w-0 content-start gap-3"
    data-testid="home-personal-overview"
  >
    <div class="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
      <h2 class="font-semibold text-base tracking-tight">{copy.title}</h2>
      {#if overview}
        <Button
          class="h-auto min-h-6 gap-0.5 px-0 text-muted-foreground md:min-h-6"
          href="/workspace/calendar"
          size="sm"
          variant="link"
        >
          {copy.viewAll}
          <ChevronRightIcon class="size-4" aria-hidden="true" />
        </Button>
      {/if}
    </div>

    <!--
      One row of four at every width, so the band is the same height loading,
      loaded and failed, and nothing below it moves when the fetch lands.
    -->
    {#if failed}
      <div class="grid min-h-20 content-center justify-items-start gap-2 rounded-lg border p-4">
        <p role="alert" class="text-muted-foreground text-sm">{copy.failed}</p>
        <Button variant="outline" size="sm" onclick={() => { loadedFor = ""; }}>
          {copy.retry}
        </Button>
      </div>
    {:else}
      <div class="grid min-h-20 grid-cols-4 items-stretch gap-2">
        {#if overview}
          {#each tiles as tile (tile.href)}
            <Item.Root size="sm" class="h-full items-start rounded-lg border p-3">
              {#snippet child({ props })}
                <a href={tile.href} {...props}>
                  <Item.Content class="min-w-0 gap-0.5">
                    <span class="font-semibold text-2xl tabular-nums tracking-tight">
                      {tile.value}
                    </span>
                    <Item.Description class="text-xs">{tile.label}</Item.Description>
                  </Item.Content>
                </a>
              {/snippet}
            </Item.Root>
          {/each}
        {:else}
          {#each [0, 1, 2, 3] as placeholder (placeholder)}
            <div
              aria-hidden="true"
              class="grid h-full content-start gap-2 rounded-lg border p-3"
              data-testid="home-personal-loading"
            >
              <Skeleton class="h-7 w-8 rounded" />
              <Skeleton class="h-3 w-14 rounded" />
            </div>
          {/each}
        {/if}
      </div>
    {/if}
  </section>
{/if}
