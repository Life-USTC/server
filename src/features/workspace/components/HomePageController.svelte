<script lang="ts">
import BellIcon from "@lucide/svelte/icons/bell";
import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
import SearchIcon from "@lucide/svelte/icons/search";
import SparklesIcon from "@lucide/svelte/icons/sparkles";
import type { Component } from "svelte";
import FeatureDirectory from "#lib/components/shell/FeatureDirectory.svelte";
import { Button } from "#lib/components/ui/button/index.js";
import * as Card from "#lib/components/ui/card/index.js";
import * as Item from "#lib/components/ui/item/index.js";
import { Skeleton } from "#lib/components/ui/skeleton/index.js";
import type { LayoutCopy } from "#lib/shell/layout-server-data.js";
import { getShellViewer } from "#lib/shell/shell-viewer.js";
import { cn } from "#lib/utils.js";
import DemoNotice from "@/features/demo/components/DemoNotice.svelte";
import { homePublicReadEpoch } from "@/features/demo/lib/demo-home-owner";
import type { DemoView } from "@/features/demo/lib/demo-types";
import HomeCampusNow from "@/features/workspace/components/HomeCampusNow.svelte";
import { HOME_COMPACT_ITEM_COUNT } from "@/features/workspace/lib/anonymous-home-layout";
import type { loadHomePage } from "@/features/workspace/server/anonymous-home-page-load";
import type {
  AnonymousHomeInformation,
  HomeActivityItem,
  HomeListItem,
} from "@/features/workspace/server/anonymous-home-sections";
import {
  HOME_ACTIVITIES_PATH,
  HOME_NOTICES_PATH,
} from "@/lib/navigation/internal-routes";

type HomePageData = Awaited<ReturnType<typeof loadHomePage>> & {
  copy: LayoutCopy;
  demo?: DemoView | null;
  homeSampleNotice?: string;
};

let {
  data,
  snapshotAt = null,
  overviewWeek = null,
}: {
  data: HomePageData;
  snapshotAt?: string | null;
  overviewWeek?: string | null;
} = $props();

const shellViewer = getShellViewer();
const pageDemo = $derived(data.demo ?? null);
const demo = $derived(pageDemo ?? $shellViewer.demo ?? null);
const hasPersonalOverview = $derived(
  Boolean(pageDemo || $shellViewer.demo || $shellViewer.viewer),
);
const publicReadEpoch = $derived(homePublicReadEpoch($shellViewer, pageDemo));
// Trusted SSR demo samples may render while bootstrap verifies client ownership.
const publicDataReady = $derived(
  Boolean(
    publicReadEpoch ||
      (pageDemo &&
        $shellViewer.demo?.fixtureVersion === pageDemo.fixtureVersion &&
        $shellViewer.demo?.expiresAt === pageDemo.expiresAt),
  ),
);
const home = $derived(data.homeCopy.homepage);
const info = $derived(home.information);
const campusNow = $derived(info.campusNow);
const pub = $derived(home.publicWorkspace);
let recoveredNotices = $state<HomeListItem[] | undefined>();
let recoveredActivities = $state<HomeActivityItem[] | undefined>();
let recoveredEpoch = $state("");
let noticeLoading = $state(false);
let activityLoading = $state(false);
let noticeRequest: AbortController | undefined;
let activityRequest: AbortController | undefined;
const notices = $derived(
  publicDataReady
    ? ((recoveredEpoch === publicReadEpoch ? recoveredNotices : undefined) ??
        data.information.notices)
    : null,
);
const activities = $derived(
  publicDataReady
    ? ((recoveredEpoch === publicReadEpoch ? recoveredActivities : undefined) ??
        data.information.activities)
    : null,
);
$effect(() => {
  void data.information.notices;
  void data.information.activities;
  void data.locale;
  void pageDemo?.expiresAt;
  void publicReadEpoch;
  recoveredNotices = undefined;
  recoveredActivities = undefined;
  recoveredEpoch = "";
  noticeLoading = false;
  activityLoading = false;
  return () => {
    noticeRequest?.abort();
    activityRequest?.abort();
  };
});
async function retryPublicList(section: "notices" | "activities") {
  const epoch = publicReadEpoch;
  if (!epoch) return;
  if (section === "notices" ? noticeLoading : activityLoading) return;
  const controller = new AbortController();
  if (section === "notices") {
    noticeLoading = true;
    noticeRequest = controller;
  } else {
    activityLoading = true;
    activityRequest = controller;
  }
  try {
    const response = await fetch(
      section === "notices" ? HOME_NOTICES_PATH : HOME_ACTIVITIES_PATH,
      {
        cache: "no-store",
        headers: { accept: "application/json" },
        signal: controller.signal,
      },
    );
    if (!response.ok) throw new Error("Home summary unavailable");
    const body: Partial<AnonymousHomeInformation> = await response.json();
    if (controller.signal.aborted || publicReadEpoch !== epoch) return;
    recoveredEpoch = epoch;
    if (section === "notices" && body.notices != null)
      recoveredNotices = body.notices;
    if (section === "activities" && body.activities != null)
      recoveredActivities = body.activities;
  } catch {
    // Keep this module unavailable and its full-list link usable for another retry.
  } finally {
    if (!controller.signal.aborted && publicReadEpoch === epoch) {
      if (section === "notices") noticeLoading = false;
      else activityLoading = false;
    }
  }
}

const destinations = $derived([
  { href: "/catalog/sections", label: pub.cards.sections.title },
  { href: "/catalog/links", label: pub.cards.links.title },
  { href: "/catalog/bus", label: pub.cards.bus.title },
  { href: "/usage/mobile", label: pub.cards.mobileApp.title },
  { href: "/catalog/courses", label: pub.cards.courses.title },
  { href: "/catalog/teachers", label: pub.cards.teachers.title },
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
      href={demo ? undefined : viewAllHref}
      disabled={Boolean(demo)}
      aria-describedby={demo ? "demo-unavailable" : undefined}
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

{#snippet itemList(items: HomeListItem[], emptyMessage: string, activity = false)}
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
            <svelte:element this={demo ? "div" : "a"} href={demo ? undefined : item.href} role={demo ? "link" : undefined} aria-disabled={demo ? true : undefined} aria-describedby={demo ? "demo-unavailable" : undefined} tabindex={demo ? -1 : undefined} {...props}>
              <Item.Content class="min-w-0 gap-0.5">
                <Item.Title class={activity ? "block w-full line-clamp-none [overflow-wrap:anywhere]" : "break-words"}>{item.title}</Item.Title>
                {#if item.meta || item.dateLabel}
                  <Item.Description class={activity ? "flex! flex-col gap-0.5 line-clamp-none [overflow-wrap:anywhere]" : "flex flex-wrap gap-x-2 gap-y-0.5"}>
                    {#if item.meta}<span class="break-words">{item.meta}</span>{/if}
                    {#if item.dateLabel}
                      <span class="tabular-nums">{item.dateLabel}</span>
                    {/if}
                  </Item.Description>
                {/if}
              </Item.Content>
            </svelte:element>
          {/snippet}
        </Item.Root>
      {/each}
    </Item.Group>
  {/if}
{/snippet}

<svelte:head>
  <title>{pub.title} - Life@USTC</title>
</svelte:head>

<div class="grid min-w-0 gap-6 pb-2 lg:gap-8">
  {#if demo}
    <DemoNotice {demo} locale={data.locale} />
    {#if data.homeSampleNotice}<p data-testid="demo-home-samples" class="text-pretty text-sm text-muted-foreground">{data.homeSampleNotice}</p>{/if}
  {/if}
  <header class="flex min-w-0 flex-wrap items-center justify-between gap-4">
    <div class="grid min-w-0 gap-1">
      <h1 class="text-pretty font-semibold text-xl tracking-tight sm:text-2xl">{pub.title}</h1>
      <p class="max-w-2xl text-pretty text-muted-foreground text-sm">{pub.description}</p>
    </div>
    <Button href="/catalog/sections" variant="outline" data-testid="home-section-search">
      <SearchIcon data-icon="inline-start" />
      {pub.cards.sections.title}
    </Button>
  </header>

  {#if hasPersonalOverview}
    {#await import("./HomePersonalOverview.svelte")}
      <Skeleton class="h-48 w-full" aria-hidden="true" />
    {:then { default: HomePersonalOverview }}
      <HomePersonalOverview copy={home.personal} locale={data.locale} {snapshotAt} {overviewWeek} demo={pageDemo} />
    {/await}
  {/if}

  <div class={cn("grid min-w-0 gap-6", !hasPersonalOverview && "xl:grid-cols-[minmax(0,1fr)_minmax(15rem,18rem)] xl:items-start")}>
    <div class="grid min-w-0 gap-6 lg:grid-cols-2 lg:gap-x-10 lg:gap-y-8">
      <HomeCampusNow
        demo={pageDemo}
        busTitle={pub.cards.bus.title}
        locale={data.locale}
        {campusNow}
        weatherLocationNames={data.homeCopy.weather.locationNames}
        weatherTitle={data.homeCopy.weather.title}
      />
      <section class="grid min-w-0 content-start gap-2" data-testid="home-notices" aria-busy={!publicDataReady || noticeLoading}>
        {@render heading("h2", BellIcon, info.notices.title, "/news", info.notices.viewAll)}
        {#if !publicDataReady}
          <Skeleton class="h-24 w-full" aria-hidden="true" />
        {:else if notices === null}
          {@render note(info.notices.unavailable)}
          <Button class="justify-self-start" variant="outline" size="sm" disabled={noticeLoading} onclick={() => retryPublicList("notices")}>{info.notices.retry}</Button>
        {:else}
          {@render itemList(notices, info.notices.empty)}
        {/if}
      </section>
      <section class="grid min-w-0 content-start gap-2" data-testid="home-activities" aria-busy={!publicDataReady || activityLoading}>
        {@render heading("h2", SparklesIcon, info.activities.title, "/catalog/young-events", info.activities.viewAll)}
        {#if !publicDataReady}
          <Skeleton class="h-24 w-full" aria-hidden="true" />
        {:else if activities === null}
          {@render note(info.activities.unavailable)}
          <Button class="justify-self-start" variant="outline" size="sm" disabled={activityLoading} onclick={() => retryPublicList("activities")}>{info.activities.retry}</Button>
        {:else if activities.length === 0}
          {@render note(info.activities.empty)}
        {:else}
          {#each [false, true] as crossDay}
            {@const group = activities.filter((item) => item.crossDay === crossDay)}
            {#if group.length}
              <div class="grid min-w-0 gap-1">
                <h3 class="text-sm font-medium">{crossDay ? info.activities.crossDay : info.activities.upcoming}</h3>
                {@render itemList(group, info.activities.empty, true)}
              </div>
            {/if}
          {/each}
        {/if}
      </section>
    </div>

    {#if !hasPersonalOverview}
      <Card.Root class="gap-4" data-testid="home-sign-in">
        <Card.Header>
          <Card.Title>{info.signInPrompt.title}</Card.Title>
          <Card.Description>{info.signInPrompt.description}</Card.Description>
        </Card.Header>
        <Card.Content class="grid gap-4">
          <Button class="justify-self-start xl:w-full" href="/account/sign-in">{home.actions.signIn}</Button>
          <nav aria-label={pub.exploreLabel} class="grid gap-1">
            <span class="text-muted-foreground text-sm">{pub.exploreLabel}</span>
            <div class="flex flex-wrap items-center gap-x-4 gap-y-1 xl:flex-col xl:items-stretch xl:gap-y-0">
              {#each destinations as destination (destination.href)}
                <Button
                  class="h-auto min-h-8 px-0 md:min-h-8 xl:justify-start"
                  href={destination.href}
                  size="sm"
                  variant="link"
                >
                  {destination.label}
                </Button>
              {/each}
            </div>
          </nav>
        </Card.Content>
      </Card.Root>
    {/if}
  </div>

  <section aria-labelledby="home-directory-heading" class="grid min-w-0 content-start gap-3 border-t pt-6" data-testid="home-directory">
    <div class="grid min-w-0 gap-1">
      <h2 class="font-semibold text-base tracking-tight" id="home-directory-heading">{data.copy.nav.hub.title}</h2>
      <p class="max-w-2xl text-pretty text-muted-foreground text-sm">{data.copy.nav.hub.description}</p>
    </div>
    <FeatureDirectory copy={data.copy} searchId="home-feature-search" />
  </section>
</div>
