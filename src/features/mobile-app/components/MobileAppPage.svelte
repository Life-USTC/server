<script lang="ts">
import { onMount } from "svelte";

type ScreenshotCopy = {
  alt: string;
  title: string;
};

type PageData = {
  copy: {
    homepage: {
      downloadBadgeAlt: string;
    };
    metadata: { mobileApp: string };
    mobileAppPage: {
      galleryTitle: string;
      screenshots: {
        bus: ScreenshotCopy;
        catalog: ScreenshotCopy;
        schedule: ScreenshotCopy;
        workspace: ScreenshotCopy;
      };
      subtitle: string;
      title: string;
    };
  };
};

export let data: PageData;

const HERO_COUNT = 3;
const HERO_INTERVAL_MS = 2800;

/** Official Apple Design Resources — iPhone 16 Pro Max Black Titanium Portrait */
const IPHONE_BEZEL_SRC = "/images/mobile-app/iphone-16-pro-max-bezel.png";

$: homeCopy = data.copy.homepage;
$: pageCopy = data.copy.mobileAppPage;
$: heroShots = [
  {
    copy: pageCopy.screenshots.schedule,
    src: "/images/mobile-app/screenshot-01.png",
  },
  {
    copy: pageCopy.screenshots.bus,
    src: "/images/mobile-app/screenshot-02.png",
  },
  {
    copy: pageCopy.screenshots.catalog,
    src: "/images/mobile-app/screenshot-03.png",
  },
];
$: screenshots = [
  ...heroShots,
  {
    copy: pageCopy.screenshots.workspace,
    src: "/images/mobile-app/screenshot-04.png",
  },
];

let frontIndex = 0;

onMount(() => {
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  const tick = () => {
    if (media.matches) return;
    frontIndex = (frontIndex + 1) % HERO_COUNT;
  };
  const id = window.setInterval(tick, HERO_INTERVAL_MS);
  return () => window.clearInterval(id);
});
</script>

<style>
  @keyframes -global-mobile-app-rise {
    from {
      opacity: 0;
      transform: translateY(1.25rem);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes -global-mobile-app-drift {
    from {
      opacity: 0;
      transform: translateY(2rem) scale(0.96);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  .hero-copy {
    animation: mobile-app-rise 0.7s ease-out both;
  }

  .hero-phone {
    animation: mobile-app-drift 0.9s cubic-bezier(0.22, 1, 0.36, 1) both;
  }

  .phone-slot {
    position: absolute;
    bottom: 0;
    left: 50%;
    width: 78%;
    transition:
      transform 0.75s cubic-bezier(0.22, 1, 0.36, 1),
      opacity 0.75s ease,
      width 0.75s cubic-bezier(0.22, 1, 0.36, 1);
    will-change: transform, opacity, width;
  }

  .phone-slot-front {
    z-index: 20;
    width: 100%;
    opacity: 1;
    transform: translateX(-50%) rotate(0deg) scale(1);
  }

  .phone-slot-left {
    z-index: 0;
    opacity: 0.9;
    transform: translateX(calc(-50% - 48%)) rotate(-6deg) scale(0.96);
  }

  .phone-slot-right {
    z-index: 10;
    opacity: 0.9;
    transform: translateX(calc(-50% + 48%)) rotate(6deg) scale(0.96);
  }

  /* Official Apple bezel overlay; screen hole measured from the PNG. */
  .phone-frame {
    position: relative;
    filter: drop-shadow(0 25px 50px rgb(0 0 0 / 0.28));
  }

  .phone-screen {
    position: absolute;
    /* Slightly under the bezel lip to hide subpixel hairlines. */
    inset: 2.05% 4.95%;
    z-index: 0;
    overflow: hidden;
    /* Match iPhone 16 Pro Max screen corners (~224px on the 1470×3000 bezel). */
    border-radius: 17% / 7.7%;
    background: #000;
  }

  .phone-screen img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center top;
    /* Bleed under the bezel so no 1px gap remains at the clip edge. */
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

  @media (prefers-reduced-motion: reduce) {
    .phone-slot {
      transition: none;
    }
  }

  .gallery-item {
    animation: mobile-app-rise 0.65s ease-out both;
  }

  .gallery-item:nth-child(1) {
    animation-delay: 0.05s;
  }
  .gallery-item:nth-child(2) {
    animation-delay: 0.12s;
  }
  .gallery-item:nth-child(3) {
    animation-delay: 0.19s;
  }
  .gallery-item:nth-child(4) {
    animation-delay: 0.26s;
  }
</style>

<svelte:head><title>{data.copy.metadata.mobileApp} - Life@USTC</title></svelte:head>

<section class="grid gap-10 pb-8">
  <div
    class="relative -mx-4 -mt-4 overflow-x-clip bg-[radial-gradient(120%_80%_at_10%_0%,color-mix(in_oklab,var(--primary)_14%,transparent),transparent_55%),linear-gradient(180deg,color-mix(in_oklab,var(--muted)_55%,transparent),var(--background))] sm:-mx-5 lg:-mx-6"
  >
    <div
      class="grid items-end gap-8 px-4 pt-8 pb-10 sm:px-5 sm:pt-10 sm:pb-12 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:gap-10 lg:px-6 lg:pt-12 lg:pb-14"
    >
      <div class="hero-copy grid max-w-xl content-center gap-5 pb-2 lg:pb-6">
        <img
          alt=""
          class="size-14 rounded-2xl border border-border shadow-sm"
          height="56"
          src="/images/mobile-app/app-icon.png"
          width="56"
        />

        <div class="grid gap-3">
          <h1
            class="text-balance font-semibold text-4xl tracking-tight sm:text-5xl lg:text-6xl"
          >
            {pageCopy.title}
          </h1>
          <p class="max-w-md text-pretty text-base text-muted-foreground sm:text-lg">
            {pageCopy.subtitle}
          </p>
        </div>

        <a
          class="inline-flex w-fit rounded-md no-underline transition hover:opacity-90"
          href="https://apps.apple.com/us/app/life-ustc/id1660437438"
          rel="noreferrer"
          target="_blank"
        >
          <img
            alt={homeCopy.downloadBadgeAlt}
            height="44"
            src="/images/appstore.svg"
            width="150"
          />
        </a>
      </div>

      <div
        class="hero-phone relative mx-auto w-full max-w-md lg:max-w-xl lg:justify-self-end"
      >
        <div
          class="pointer-events-none absolute inset-x-8 bottom-8 h-24 rounded-full bg-foreground/10 blur-3xl"
          aria-hidden="true"
        ></div>
        <div class="relative mx-auto w-[78%] sm:w-[68%]" aria-live="polite">
          <img
            alt=""
            aria-hidden="true"
            class="invisible block h-auto w-full"
            decoding="async"
            src={IPHONE_BEZEL_SRC}
          />
          {#each heroShots as shot, index (shot.src)}
            {@const relative = (index - frontIndex + HERO_COUNT) % HERO_COUNT}
            <figure
              class="phone-slot"
              class:phone-slot-front={relative === 0}
              class:phone-slot-right={relative === 1}
              class:phone-slot-left={relative === 2}
            >
              <div class="phone-frame">
                <div class="phone-screen">
                  <img
                    alt={shot.copy.alt}
                    decoding="async"
                    fetchpriority={index === 0 ? "high" : undefined}
                    loading="eager"
                    src={shot.src}
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
            </figure>
          {/each}
        </div>
      </div>
    </div>
  </div>

  <div class="grid gap-4">
    <h2 class="font-semibold text-2xl tracking-normal">{pageCopy.galleryTitle}</h2>

    <div class="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
      {#each screenshots as shot}
        <figure class="gallery-item grid gap-3">
          <div class="phone-frame transition duration-300 hover:-translate-y-1">
            <div class="phone-screen">
              <img
                alt={shot.copy.alt}
                decoding="async"
                loading="lazy"
                src={shot.src}
              />
            </div>
            <img
              alt=""
              aria-hidden="true"
              class="phone-bezel"
              decoding="async"
              loading="lazy"
              src={IPHONE_BEZEL_SRC}
            />
          </div>
          <figcaption class="px-1 font-medium text-sm">{shot.copy.title}</figcaption>
        </figure>
      {/each}
    </div>
  </div>
</section>
