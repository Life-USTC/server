<script lang="ts">
import BellIcon from "@lucide/svelte/icons/bell";
import BusFrontIcon from "@lucide/svelte/icons/bus-front";
import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
import CloudSunIcon from "@lucide/svelte/icons/cloud-sun";
import SparklesIcon from "@lucide/svelte/icons/sparkles";
import type { Component } from "svelte";
import { Button } from "#lib/components/ui/button/index.js";
import * as Item from "#lib/components/ui/item/index.js";
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

type AnonymousHomePageData = {
  copy: {
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
          weatherUnavailable: string;
          weatherViewAll: string;
        };
        notices: SectionCopy;
        signInPrompt: { description: string; title: string };
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
  signedIn: false;
};

let { data }: { data: AnonymousHomePageData } = $props();

const home = $derived(data.copy.homepage);
const info = $derived(home.information);
const campusNow = $derived(info.campusNow);
const pub = $derived(home.publicWorkspace);
const weather = $derived(data.information.weather);
const bus = $derived(data.information.bus);
const notices = $derived(data.information.notices);
const activities = $derived(data.information.activities);

const destinations = $derived([
  { href: "/catalog/courses", label: pub.cards.courses.title },
  { href: "/catalog/sections", label: pub.cards.sections.title },
  { href: "/catalog/teachers", label: pub.cards.teachers.title },
  { href: "/catalog/links", label: pub.cards.links.title },
  { href: "/catalog/bus", label: pub.cards.bus.title },
  { href: "/usage/mobile", label: pub.cards.mobileApp.title },
]);
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
      class="h-auto min-h-6 gap-0.5 px-0 text-muted-foreground"
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
      {#each items as item (item.key)}
        <Item.Root class="min-w-0" size="sm">
          {#snippet child({ props })}
            <a class="min-h-12" href={item.href} {...props}>
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
  <title>{data.copy.metadata.home} - Life@USTC</title>
</svelte:head>

<div class="grid min-w-0 gap-6 pb-2 lg:grid-cols-2 lg:gap-x-10 lg:gap-y-8">
  <header class="grid min-w-0 gap-1 lg:col-span-2">
    <h1 class="text-pretty font-semibold text-xl tracking-tight sm:text-2xl">
      {pub.title}
    </h1>
    <p class="hidden max-w-2xl text-pretty text-muted-foreground text-sm sm:block">
      {pub.description}
    </p>
  </header>

  <section class="grid min-w-0 gap-3 lg:col-span-2" data-testid="home-campus-now">
    <h2 class="sr-only">{campusNow.title}</h2>
    <div class="grid min-w-0 gap-3 sm:grid-cols-2">
      <div class="grid min-w-0 content-start gap-2 rounded-lg border p-4">
        {@render heading(
          "h3",
          CloudSunIcon,
          data.copy.weather.title,
          "/catalog/weather",
          campusNow.weatherViewAll,
        )}
        {#if weather === null || weather.length === 0}
          {@render note(campusNow.weatherUnavailable)}
        {:else}
          <dl class="grid grid-cols-2 gap-x-4 gap-y-2">
            {#each weather as tile (tile.locationKey)}
              <div class="min-w-0">
                <dt class="truncate text-muted-foreground text-sm">
                  {data.copy.weather.locationNames[tile.locationKey] ?? tile.locationKey}
                </dt>
                <dd class="flex min-w-0 flex-wrap items-baseline gap-x-2">
                  {#if tile.temperature}
                    <span class="font-semibold text-2xl tabular-nums tracking-tight">
                      {tile.temperature}
                    </span>
                  {/if}
                  <span class="min-w-0 truncate text-muted-foreground text-sm">
                    {tile.condition}
                  </span>
                </dd>
              </div>
            {/each}
          </dl>
        {/if}
      </div>

      <div class="grid min-w-0 content-start gap-2 rounded-lg border p-4">
        {@render heading(
          "h3",
          BusFrontIcon,
          pub.cards.bus.title,
          "/catalog/bus",
          campusNow.busViewAll,
        )}
        {#if bus === null}
          {@render note(campusNow.busUnavailable)}
        {:else if bus.departures.length === 0}
          {@render note(bus.emptyNote)}
        {:else}
          {@render note(bus.originNote)}
          <ul class="grid gap-1.5">
            {#each bus.departures as departure (departure.key)}
              <li class="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <span class="min-w-0 truncate">{departure.destination}</span>
                <span class="flex shrink-0 items-baseline gap-2">
                  <span class="tabular-nums">{departure.departureTime}</span>
                  <span class="text-muted-foreground text-sm">
                    {departure.relativeLabel}
                  </span>
                </span>
              </li>
            {/each}
          </ul>
        {/if}
      </div>
    </div>
  </section>

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

  <section
    class="grid min-w-0 gap-3 rounded-lg border bg-muted/40 p-4 lg:col-span-2"
    data-testid="home-sign-in"
  >
    <div class="grid gap-1">
      <h2 class="font-semibold text-base tracking-tight">{info.signInPrompt.title}</h2>
      <p class="text-pretty text-muted-foreground text-sm">
        {info.signInPrompt.description}
      </p>
    </div>
    <div>
      <Button class="h-10 min-w-28" href="/account/sign-in">
        {home.actions.signIn}
      </Button>
    </div>
    <nav aria-label={pub.exploreLabel} class="grid gap-1">
      <span class="text-muted-foreground text-sm">{pub.exploreLabel}</span>
      <div class="flex flex-wrap items-center gap-x-4 gap-y-1">
        {#each destinations as destination (destination.href)}
          <Button
            class="h-auto min-h-6 px-0"
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
</div>
