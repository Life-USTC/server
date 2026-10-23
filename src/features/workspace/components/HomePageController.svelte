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
import HomeCampusNow from "@/features/workspace/components/HomeCampusNow.svelte";
import { HOME_COMPACT_ITEM_COUNT } from "@/features/workspace/lib/anonymous-home-layout";
import type { loadHomePage } from "@/features/workspace/server/anonymous-home-page-load";
import type { HomeListItem } from "@/features/workspace/server/anonymous-home-sections";

type HomePageData = Awaited<ReturnType<typeof loadHomePage>> & {
  copy: LayoutCopy;
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
const home = $derived(data.homeCopy.homepage);
const info = $derived(home.information);
const campusNow = $derived(info.campusNow);
const pub = $derived(home.publicWorkspace);
const notices = $derived(data.information.notices);
const activities = $derived(data.information.activities);

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
  <title>{pub.title} - Life@USTC</title>
</svelte:head>

<div class="grid min-w-0 gap-6 pb-2 lg:gap-8">
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

  {#if $shellViewer.viewer}
    {#await import("./HomePersonalOverview.svelte")}
      <Skeleton class="h-48 w-full" aria-hidden="true" />
    {:then { default: HomePersonalOverview }}
      <HomePersonalOverview copy={home.personal} locale={data.locale} {snapshotAt} {overviewWeek} />
    {/await}
  {/if}

  <div class={cn("grid min-w-0 gap-6", !$shellViewer.viewer && "xl:grid-cols-[minmax(0,1fr)_minmax(15rem,18rem)] xl:items-start")}>
    <div class="grid min-w-0 gap-6 lg:grid-cols-2 lg:gap-x-10 lg:gap-y-8">
      <HomeCampusNow
        busTitle={pub.cards.bus.title}
        {campusNow}
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
        {@render heading("h2", SparklesIcon, info.activities.title, "/catalog/young-events", info.activities.viewAll)}
        {#if activities === null}
          {@render note(info.activities.unavailable)}
        {:else}
          {@render itemList(activities, info.activities.empty)}
        {/if}
      </section>
    </div>

    {#if !$shellViewer.viewer}
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
