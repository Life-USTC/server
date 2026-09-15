<script lang="ts">
import ArrowRightIcon from "@lucide/svelte/icons/arrow-right";
import BookOpenIcon from "@lucide/svelte/icons/book-open";
import BusIcon from "@lucide/svelte/icons/bus";
import GraduationCapIcon from "@lucide/svelte/icons/graduation-cap";
import LinkIcon from "@lucide/svelte/icons/link";
import SmartphoneIcon from "@lucide/svelte/icons/smartphone";
import UsersIcon from "@lucide/svelte/icons/users";
import type { Component } from "svelte";
import appIconUrl from "$lib/assets/life-ustc-icon-192.png";
import { Button } from "$lib/components/ui/button/index.js";
import * as Item from "$lib/components/ui/item/index.js";

type DestinationCopy = { description: string; title: string };

type AnonymousHomePageData = {
  copy: {
    homepage: {
      actions: {
        mobileApp: string;
        signIn: string;
      };
      appIconAlt: string;
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
  };
  signedIn: false;
};

export let data: AnonymousHomePageData;

$: home = data.copy.homepage;
$: pub = home.publicWorkspace;

type Destination = {
  copy: DestinationCopy;
  href: string;
  icon: Component;
};

/** Official Apple Design Resources — iPhone 16 Pro Max Black Titanium Portrait */
const IPHONE_BEZEL_SRC = "/images/mobile-app/iphone-16-pro-max-bezel.png";
const HERO_SCREENSHOT_SRC = "/images/mobile-app/screenshot-01.png";

$: destinations = [
  { copy: pub.cards.courses, href: "/catalog/courses", icon: BookOpenIcon },
  {
    copy: pub.cards.sections,
    href: "/catalog/sections",
    icon: GraduationCapIcon,
  },
  { copy: pub.cards.teachers, href: "/catalog/teachers", icon: UsersIcon },
  { copy: pub.cards.links, href: "/catalog/links", icon: LinkIcon },
  { copy: pub.cards.bus, href: "/catalog/bus", icon: BusIcon },
  {
    copy: pub.cards.mobileApp,
    href: "/usage/mobile",
    icon: SmartphoneIcon,
  },
] satisfies Destination[];
</script>

<svelte:head>
  <title>{data.copy.metadata.home} - Life@USTC</title>
</svelte:head>

<section
  class="anonymous-home -mx-4 -mt-4 -mb-4 flex min-h-full flex-col sm:-mx-5 sm:-mb-4 lg:-mx-6"
>
  <div
    class="anonymous-hero relative flex flex-1 items-center justify-center overflow-hidden px-4 py-10 sm:px-5 sm:py-12 lg:px-6 lg:py-14"
  >
    <div
      class="relative mx-auto grid w-full max-w-5xl items-center gap-10 lg:max-w-6xl lg:grid-cols-[minmax(0,1fr)_minmax(15rem,20rem)] lg:gap-x-20 lg:gap-y-10"
    >
      <div class="anonymous-rise grid gap-6">
        <div
          class="anonymous-brand inline-flex items-center gap-3 sm:gap-4"
          aria-label="Life@USTC"
        >
          <img
            alt=""
            aria-hidden="true"
            class="size-10 rounded-xl sm:size-12"
            decoding="async"
            height="48"
            src={appIconUrl}
            width="48"
          />
          <span class="anonymous-brand-text">Life@USTC</span>
        </div>

        <div class="grid gap-3">
          <h1 class="anonymous-headline">{pub.title}</h1>
          <p
            class="max-w-md text-pretty text-muted-foreground text-base leading-relaxed sm:text-lg"
          >
            {pub.description}
          </p>
        </div>

        <div>
          <Button
            class="h-11 min-w-28 justify-between gap-3 px-5"
            href="/account/sign-in"
            size="lg"
          >
            <span>{home.actions.signIn}</span>
            <ArrowRightIcon data-icon="inline-end" />
          </Button>
        </div>

        <div class="grid gap-3">
          <h2 class="font-medium text-muted-foreground text-sm tracking-wide">
            {pub.exploreLabel}
          </h2>
          <Item.Group class="grid grid-cols-2 gap-x-4 gap-y-3">
            {#each destinations as destination}
              <Item.Root class="min-w-0" size="default" variant="outline">
                {#snippet child({ props })}
                  <a class="min-h-12" href={destination.href} {...props}>
                    <Item.Media class="text-primary" variant="icon">
                      <destination.icon />
                    </Item.Media>
                    <Item.Content class="min-w-0">
                      <Item.Title>{destination.copy.title}</Item.Title>
                    </Item.Content>
                  </a>
                {/snippet}
              </Item.Root>
            {/each}
          </Item.Group>
        </div>
      </div>

      <div
        class="anonymous-rise anonymous-rise-delay relative mx-auto w-full max-w-[13.5rem] sm:max-w-[15rem] lg:mx-0 lg:max-w-[20rem]"
      >
        <div
          class="pointer-events-none absolute inset-x-4 bottom-5 h-14 rounded-full bg-foreground/10 blur-3xl"
          aria-hidden="true"
        ></div>
        <div class="phone-frame relative mx-auto w-full">
          <div class="phone-screen">
            <img
              alt=""
              decoding="async"
              fetchpriority="high"
              src={HERO_SCREENSHOT_SRC}
            />
          </div>
          <img
            alt=""
            aria-hidden="true"
            class="phone-bezel"
            decoding="async"
            src={IPHONE_BEZEL_SRC}
          />
        </div>
      </div>
    </div>
  </div>
</section>

<style>
  .anonymous-home {
    min-height: max(100%, calc(100svh - 7.5rem));
    background:
      radial-gradient(
        90% 60% at 50% 0%,
        color-mix(in oklab, var(--primary) 18%, transparent),
        transparent 58%
      ),
      linear-gradient(
        180deg,
        color-mix(in oklab, var(--muted) 75%, transparent) 0%,
        color-mix(in oklab, var(--muted) 40%, var(--background)) 45%,
        var(--background) 100%
      );
  }

  .anonymous-brand-text {
    font-size: clamp(1.75rem, 3.5vw, 2.5rem);
    font-weight: 600;
    letter-spacing: -0.02em;
    line-height: 1;
  }

  .anonymous-headline {
    font-size: clamp(1.35rem, 2.4vw, 1.85rem);
    font-weight: 600;
    letter-spacing: -0.02em;
    line-height: 1.25;
  }

  .phone-frame {
    position: relative;
    filter: drop-shadow(0 25px 50px rgb(0 0 0 / 0.28));
  }

  .phone-screen {
    position: absolute;
    inset: 2.05% 4.95%;
    z-index: 0;
    overflow: hidden;
    border-radius: 17% / 7.7%;
    background: #000;
  }

  .phone-screen img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center top;
    transform: scale(1.02);
    transform-origin: center top;
  }

  .phone-bezel {
    position: relative;
    z-index: 1;
    display: block;
    width: 100%;
    height: auto;
    pointer-events: none;
    user-select: none;
  }

  .anonymous-rise {
    animation: anonymous-rise 0.7s ease-out both;
  }

  .anonymous-rise-delay {
    animation-delay: 0.12s;
  }

  @keyframes anonymous-rise {
    from {
      opacity: 0;
      transform: translateY(16px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .anonymous-rise {
      animation: none;
    }
  }
</style>
