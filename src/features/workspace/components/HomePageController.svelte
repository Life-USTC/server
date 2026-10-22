<script lang="ts">
import BellIcon from "@lucide/svelte/icons/bell";
import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
import SparklesIcon from "@lucide/svelte/icons/sparkles";
import type { Component } from "svelte";
import FeatureDirectory from "#lib/components/shell/FeatureDirectory.svelte";
import { Button } from "#lib/components/ui/button/index.js";
import * as Item from "#lib/components/ui/item/index.js";
import type { LayoutCopy } from "#lib/shell/layout-server-data.js";
import { getShellViewer } from "#lib/shell/shell-viewer.js";
import HomeCampusNow from "@/features/workspace/components/HomeCampusNow.svelte";
import HomePersonalOverview from "@/features/workspace/components/HomePersonalOverview.svelte";
import { HOME_COMPACT_ITEM_COUNT } from "@/features/workspace/lib/anonymous-home-layout";
import type {
  AnonymousHomeInformation,
  HomeListItem,
} from "@/features/workspace/server/anonymous-home-sections";

type DestinationCopy = { description: string; title: string };

type SectionCopy = {
  empty: string;
  title: string;
  unavailable: string;
  viewAll: string;
};

type HomePageData = {
  /** Root-layout copy; the product directory is built from it. */
  copy: LayoutCopy;
  homeCopy: {
    homepage: {
      actions: { mobileApp: string; signIn: string };
      appIconAlt: string;
      information: {
        activities: SectionCopy;
        campusNow: {
          busDepartingNow: string;
          busEmpty: string;
          busMinutes: string;
          busOriginNote: string;
          busUnavailable: string;
          busViewAll: string;
          title: string;
          weatherHourly: string;
          weatherRange: string;
          weatherUnavailable: string;
          weatherViewAll: string;
        };
        notices: SectionCopy;
        signInPrompt: { description: string; title: string };
      };
      personal: {
        counts: {
          pendingHomeworks: string;
          pendingTodos: string;
          todaySchedules: string;
          upcomingExams: string;
        };
        failed: string;
        retry: string;
        title: string;
        viewAll: string;
      };
      publicWorkspace: {
        cards: {
          bus: DestinationCopy;
          courses: DestinationCopy;
          links: DestinationCopy;
          mobileApp: DestinationCopy;
          sections: DestinationCopy;
          signIn: DestinationCopy;
          teachers: DestinationCopy;
        };
        description: string;
        exploreLabel: string;
        title: string;
      };
      subtitle: string;
      title: { line1: string; line2: string };
    };
    metadata: { home: string };
    weather: { locationNames: Record<string, string>; title: string };
  };
  information: AnonymousHomeInformation;
};

let {
  data,
  snapshotAt = null,
}: { data: HomePageData; snapshotAt?: string | null } = $props();

const shellViewer = getShellViewer();
const home = $derived(data.homeCopy.homepage);
const info = $derived(home.information);
const campusNow = $derived(info.campusNow);
const pub = $derived(home.publicWorkspace);
const notices = $derived(data.information.notices);
const activities = $derived(data.information.activities);

/**
 * A student arrives looking for the teaching section they actually attend, not
 * the abstract course or the teacher who happens to run it, so the section
 * catalog leads the rail and is the only entry drawn at full contrast. Course
 * and teacher stay reachable but move behind the campus links they rank below.
 */
const destinations = $derived([
  { href: "/catalog/sections", label: pub.cards.sections.title, primary: true },
  { href: "/catalog/links", label: pub.cards.links.title, primary: false },
  { href: "/catalog/bus", label: pub.cards.bus.title, primary: false },
  { href: "/usage/mobile", label: pub.cards.mobileApp.title, primary: false },
  { href: "/catalog/courses", label: pub.cards.courses.title, primary: false },
  {
    href: "/catalog/teachers",
    label: pub.cards.teachers.title,
    primary: false,
  },
]);

/**
 * Rows past the compact count are shipped to every viewport and revealed by the
 * breakpoint, so a phone keeps the list it had while a wide canvas fills the
 * column it already owns.
 */
function overflowClass(index: number, shown: string, hidden: string): string {
  return index < HOME_COMPACT_ITEM_COUNT ? shown : hidden;
}
</script>

{#snippet heading(
  level: "h2" | "h3",
  icon: Component,
  title: string,
  viewAllHref: string,
  viewAllLabel: string,
)}
  {@const Icon = icon}
  <div class="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
    <svelte:element
      this={level}
      class="flex min-w-0 items-center gap-2 font-semibold text-base tracking-tight"
    >
      <Icon class="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span class="min-w-0 truncate">{title}</span>
    </svelte:element>
    <Button
      class="h-auto min-h-6 gap-0.5 px-0 text-muted-foreground md:min-h-6"
      href={viewAllHref}
      size="sm"
      variant="link"
    >
      {viewAllLabel}
      <ChevronRightIcon class="size-4" aria-hidden="true" />
    </Button>
  </div>
{/snippet}

{#snippet note(message: string)}
  <p class="text-muted-foreground text-sm">{message}</p>
{/snippet}

{#snippet itemList(items: HomeListItem[], emptyMessage: string)}
  {#if items.length === 0}
    {@render note(emptyMessage)}
  {:else}
    <Item.Group class="min-w-0 gap-0">
      {#each items as item, index (item.key)}
        <Item.Root
          class={overflowClass(
            index,
            "min-h-12 min-w-0",
            "hidden min-h-12 min-w-0 lg:flex",
          )}
          size="sm"
        >
          {#snippet child({ props })}
            <a href={item.href} {...props}>
              <Item.Content class="min-w-0 gap-0.5">
                <Item.Title class="break-words">{item.title}</Item.Title>
                {#if item.meta || item.dateLabel}
                  <Item.Description class="flex flex-wrap gap-x-2 gap-y-0.5">
                    {#if item.meta}<span class="break-words">{item.meta}</span>{/if}
                    {#if item.dateLabel}
                      <span class="tabular-nums">{item.dateLabel}</span>
                    {/if}
                  </Item.Description>
                {/if}
              </Item.Content>
            </a>
          {/snippet}
        </Item.Root>
      {/each}
    </Item.Group>
  {/if}
{/snippet}

<svelte:head>
  <title>{data.homeCopy.metadata.home} - Life@USTC</title>
</svelte:head>

<!--
  Phone and tablet keep the single/two-column stack rebuilt in #1300. From `xl`
  the page becomes two information columns plus a narrow rail: the sign-in
  prompt carries the least information on the page, so it stops being a
  full-width band under the content and becomes the rail, which hands its former
  width back to the lists.
-->
<div
  class="grid min-w-0 gap-6 pb-2 lg:gap-y-8 xl:grid-cols-[minmax(0,1fr)_minmax(15rem,18rem)] xl:items-start xl:gap-x-6"
>
  <header class="grid min-w-0 gap-1 xl:col-span-2">
    <h1 class="text-pretty font-semibold text-xl tracking-tight sm:text-2xl">
      {pub.title}
    </h1>
    <!--
      Kept visible at every width: ui.model-property-priority-discovery-views
      asserts the landing identity as primary and this description as its
      secondary property at both 1280 and 390.
    -->
    <p class="max-w-2xl text-pretty text-muted-foreground text-sm">
      {pub.description}
    </p>
  </header>

  <!--
    The viewer's own state outranks both the campus information and the
    directory for someone signed in, so it leads. It renders nothing at all for
    an anonymous visitor, which is why the stacking order below is the same one
    for everybody rather than two different pages.
  -->
  <div class="min-w-0 xl:col-span-2">
    <HomePersonalOverview copy={home.personal} {snapshotAt} />
  </div>

  <!--
    The information sections keep their own grid, so the rail beside them never
    takes part in sizing their rows: a row stretched to match the rail is how an
    empty section turns back into the tall empty box this layout removes.
  -->
  <div class="grid min-w-0 gap-6 lg:grid-cols-2 lg:gap-x-10 lg:gap-y-8">
    <HomeCampusNow
      busTitle={pub.cards.bus.title}
      campusNow={campusNow}
      weatherLocationNames={data.homeCopy.weather.locationNames}
      weatherTitle={data.homeCopy.weather.title}
    />

    <section class="grid min-w-0 content-start gap-2" data-testid="home-notices">
      {@render heading("h2", BellIcon, info.notices.title, "/news", info.notices.viewAll)}
      {#if notices === null}
        {@render note(info.notices.unavailable)}
      {:else}
        {@render itemList(notices, info.notices.empty)}
      {/if}
    </section>

    <section class="grid min-w-0 content-start gap-2" data-testid="home-activities">
      {@render heading(
        "h2",
        SparklesIcon,
        info.activities.title,
        "/catalog/young-events",
        info.activities.viewAll,
      )}
      {#if activities === null}
        {@render note(info.activities.unavailable)}
      {:else}
        {@render itemList(activities, info.activities.empty)}
      {/if}
    </section>
  </div>

  <!--
    `/` is cached and viewer-independent, so this prompt is always in the
    server-rendered HTML and is removed once the client resolves a signed-in
    viewer. It stays put while the viewer is still unknown, so the anonymous
    page — the common case — never flashes it in.
  -->
  {#if !$shellViewer.viewer}
  <section
    class="grid min-w-0 content-start gap-3 rounded-lg border bg-muted/40 p-4 xl:self-start"
    data-testid="home-sign-in"
  >
    <div class="grid gap-1">
      <h2 class="font-semibold text-base tracking-tight">{info.signInPrompt.title}</h2>
      <p class="text-pretty text-muted-foreground text-sm">
        {info.signInPrompt.description}
      </p>
    </div>
    <div>
      <Button class="h-10 min-w-28 md:min-w-28 xl:w-full" href="/account/sign-in">
        {home.actions.signIn}
      </Button>
    </div>
    <nav aria-label={pub.exploreLabel} class="grid gap-1">
      <span class="text-muted-foreground text-sm">{pub.exploreLabel}</span>
      <!--
        A row of links on the stacked layouts; one link per line in the rail,
        where the column is too narrow to wrap them readably.
      -->
      <div
        class="flex flex-wrap items-center gap-x-4 gap-y-1 xl:flex-col xl:items-stretch xl:gap-y-0"
      >
        {#each destinations as destination (destination.href)}
          <Button
            class={destination.primary
              ? "h-auto min-h-6 px-0 font-medium xl:min-h-8 xl:justify-start"
              : "h-auto min-h-6 px-0 text-muted-foreground xl:min-h-8 xl:justify-start"}
            href={destination.href}
            size="sm"
            variant="link"
          >
            {destination.label}
          </Button>
        {/each}
      </div>
    </nav>
  </section>
  {/if}

  <!--
    The directory is the "what exists" surface and is reference material, so it
    sits below the time-sensitive campus information rather than above it.
    Leading with it would bury the teaching-section search that
    `overview.decision-page` exists to protect.
  -->
  <section
    aria-labelledby="home-directory-heading"
    class="grid min-w-0 content-start gap-3 border-t pt-6 xl:col-span-2"
    data-testid="home-directory"
  >
    <div class="grid min-w-0 gap-1">
      <h2
        class="font-semibold text-base tracking-tight"
        id="home-directory-heading"
      >
        {data.copy.nav.hub.title}
      </h2>
      <p class="max-w-2xl text-pretty text-muted-foreground text-sm">
        {data.copy.nav.hub.description}
      </p>
    </div>
    <FeatureDirectory copy={data.copy} searchId="home-feature-search" />
  </section>
</div>
