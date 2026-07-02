<script lang="ts">
import BellIcon from "@lucide/svelte/icons/bell";
import BookOpenIcon from "@lucide/svelte/icons/book-open";
import CalendarDaysIcon from "@lucide/svelte/icons/calendar-days";
import ExternalLinkIcon from "@lucide/svelte/icons/external-link";
import LayoutDashboardIcon from "@lucide/svelte/icons/layout-dashboard";
import RouteIcon from "@lucide/svelte/icons/route";
import SearchIcon from "@lucide/svelte/icons/search";
import ShieldCheckIcon from "@lucide/svelte/icons/shield-check";
import SmartphoneIcon from "@lucide/svelte/icons/smartphone";
import UsersIcon from "@lucide/svelte/icons/users";
import { Badge } from "$lib/components/ui/badge/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import * as Card from "$lib/components/ui/card/index.js";

type LinkCopy = {
  description: string;
  title: string;
};

type MobileFeatureCopy = {
  description: string;
  title: string;
};

type PageData = {
  copy: {
    homepage: {
      actions: { openDashboard: string };
      appIconAlt: string;
      downloadBadgeAlt: string;
      quickAccess: {
        browseCourses: LinkCopy;
        browseTeachers: LinkCopy;
        openDashboard: LinkCopy;
        viewSections: LinkCopy;
      };
    };
    metadata: { mobileApp: string };
    mobileAppPage: {
      availability: string;
      eyebrow: string;
      featureTitle: string;
      features: {
        bus: MobileFeatureCopy;
        catalog: MobileFeatureCopy;
        profile: MobileFeatureCopy;
        schedule: MobileFeatureCopy;
      };
      preview: {
        busLabel: string;
        busStatus: string;
        calendarStatus: string;
        linksLabel: string;
        linksStatus: string;
        scheduleLabel: string;
      };
      previewStatusDescription: string;
      previewStatusTitle: string;
      previewSubtitle: string;
      previewTitle: string;
      quickLinksTitle: string;
      stats: {
        accessLabel: string;
        accessValue: string;
        companionLabel: string;
        companionValue: string;
        platformLabel: string;
        platformValue: string;
      };
      subtitle: string;
      title: string;
    };
  };
};

export let data: PageData;

$: homeCopy = data.copy.homepage;
$: pageCopy = data.copy.mobileAppPage;
$: featureItems = [
  {
    copy: pageCopy.features.schedule,
    icon: CalendarDaysIcon,
  },
  {
    copy: pageCopy.features.bus,
    icon: RouteIcon,
  },
  {
    copy: pageCopy.features.catalog,
    icon: SearchIcon,
  },
  {
    copy: pageCopy.features.profile,
    icon: ShieldCheckIcon,
  },
];
$: previewItems = [
  {
    label: pageCopy.preview.scheduleLabel,
    status: pageCopy.preview.calendarStatus,
    icon: CalendarDaysIcon,
  },
  {
    label: pageCopy.preview.busLabel,
    status: pageCopy.preview.busStatus,
    icon: RouteIcon,
  },
  {
    label: pageCopy.preview.linksLabel,
    status: pageCopy.preview.linksStatus,
    icon: BookOpenIcon,
  },
];
$: quickLinks = [
  {
    copy: homeCopy.quickAccess.openDashboard,
    href: "/",
    icon: LayoutDashboardIcon,
  },
  {
    copy: homeCopy.quickAccess.browseCourses,
    href: "/courses",
    icon: BookOpenIcon,
  },
  {
    copy: homeCopy.quickAccess.viewSections,
    href: "/sections",
    icon: CalendarDaysIcon,
  },
  {
    copy: homeCopy.quickAccess.browseTeachers,
    href: "/teachers",
    icon: UsersIcon,
  },
];
$: stats = [
  {
    label: pageCopy.stats.companionLabel,
    value: pageCopy.stats.companionValue,
  },
  {
    label: pageCopy.stats.platformLabel,
    value: pageCopy.stats.platformValue,
  },
  {
    label: pageCopy.stats.accessLabel,
    value: pageCopy.stats.accessValue,
  },
];
</script>

<svelte:head><title>{data.copy.metadata.mobileApp} - Life@USTC</title></svelte:head>

<section class="grid gap-5">
  <div class="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start">
    <Card.Root class="overflow-hidden">
      <Card.Content class="grid gap-5 p-4 sm:p-5">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div class="flex min-w-0 items-center gap-3">
            <img
              class="size-12 rounded-md border border-base-300 bg-base-100"
              src="/images/icon.png"
              alt={homeCopy.appIconAlt}
            />
            <div class="min-w-0">
              <p class="font-medium text-base-content/55 text-xs uppercase tracking-normal">
                {pageCopy.eyebrow}
              </p>
              <h1 class="truncate font-semibold text-2xl tracking-normal sm:text-3xl">
                {pageCopy.title}
              </h1>
            </div>
          </div>
          <Badge variant="outline">{pageCopy.availability}</Badge>
        </div>

        <p class="max-w-3xl text-base-content/65 text-sm leading-6 sm:text-base">
          {pageCopy.subtitle}
        </p>

        <div class="flex flex-wrap items-center gap-2">
          <a
            class="inline-flex rounded-md no-underline transition hover:opacity-90"
            href="https://apps.apple.com/us/app/life-ustc/id1660437438"
            target="_blank"
            rel="noreferrer"
          >
            <img
              src="/images/appstore.svg"
              alt={homeCopy.downloadBadgeAlt}
              width="150"
              height="44"
            />
          </a>
          <Button href="/" variant="outline">
            <LayoutDashboardIcon data-icon="inline-start" />
            {homeCopy.actions.openDashboard}
          </Button>
        </div>

        <div class="grid gap-2 sm:grid-cols-3">
          {#each stats as item}
            <div class="rounded-md border border-base-300 bg-base-200/45 px-3 py-2.5">
              <p class="font-semibold text-base leading-6">{item.value}</p>
              <p class="text-base-content/55 text-xs leading-5">{item.label}</p>
            </div>
          {/each}
        </div>
      </Card.Content>
    </Card.Root>

    <Card.Root class="overflow-hidden">
      <Card.Header class="border-base-300 border-b p-4">
        <div class="flex items-center gap-3">
          <span class="inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-base-300 bg-base-200 text-primary">
            <SmartphoneIcon />
          </span>
          <div class="min-w-0">
            <Card.Title class="truncate text-base">{pageCopy.previewTitle}</Card.Title>
            <Card.Description>{pageCopy.previewSubtitle}</Card.Description>
          </div>
        </div>
      </Card.Header>
      <Card.Content class="grid gap-3 p-4">
        <div class="rounded-md border border-base-300 bg-base-200/45 p-3">
          <div class="flex items-start gap-3">
            <span class="inline-flex size-8 shrink-0 items-center justify-center rounded-md bg-base-100 text-primary">
              <BellIcon />
            </span>
            <div class="min-w-0">
              <p class="font-medium text-sm leading-5">{pageCopy.previewStatusTitle}</p>
              <p class="text-base-content/60 text-sm leading-5">
                {pageCopy.previewStatusDescription}
              </p>
            </div>
          </div>
        </div>

        <div class="grid gap-2">
          {#each previewItems as item}
            <div class="flex items-center justify-between gap-3 rounded-md border border-base-300 px-3 py-2.5">
              <div class="flex min-w-0 items-center gap-2.5">
                <span class="mobile-app-preview-icon text-primary">
                  <svelte:component this={item.icon} />
                </span>
                <span class="truncate font-medium text-sm">{item.label}</span>
              </div>
              <span class="shrink-0 text-base-content/55 text-xs">{item.status}</span>
            </div>
          {/each}
        </div>
      </Card.Content>
    </Card.Root>
  </div>

  <div class="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start">
    <Card.Root>
      <Card.Header class="p-4 pb-0 sm:p-5 sm:pb-0">
        <Card.Title>{pageCopy.featureTitle}</Card.Title>
      </Card.Header>
      <Card.Content class="grid gap-2 p-4 sm:grid-cols-2 sm:p-5">
        {#each featureItems as item}
          <div class="flex min-w-0 gap-3 rounded-md border border-base-300 p-3">
            <span class="mobile-app-feature-icon rounded-md border-base-300 bg-base-200/55 text-primary">
              <svelte:component this={item.icon} />
            </span>
            <div class="min-w-0">
              <p class="font-medium text-sm leading-5">{item.copy.title}</p>
              <p class="mt-1 text-base-content/60 text-sm leading-5">
                {item.copy.description}
              </p>
            </div>
          </div>
        {/each}
      </Card.Content>
    </Card.Root>

    <Card.Root>
      <Card.Header class="p-4 pb-0">
        <Card.Title>{pageCopy.quickLinksTitle}</Card.Title>
      </Card.Header>
      <Card.Content class="grid gap-1.5 p-4">
        {#each quickLinks as item}
          <a
            class="group flex items-start gap-3 rounded-md px-2.5 py-2 no-underline transition hover:bg-base-200/70"
            href={item.href}
          >
            <span class="mobile-app-link-icon rounded-md border-base-300 bg-base-200/55 text-primary">
              <svelte:component this={item.icon} />
            </span>
            <span class="min-w-0 flex-1">
              <span class="flex items-start justify-between gap-2">
                <span class="truncate font-medium text-sm leading-5">{item.copy.title}</span>
                <ExternalLinkIcon class="mt-0.5 size-3.5 shrink-0 text-base-content/45 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </span>
              <span class="mt-0.5 line-clamp-2 block text-base-content/60 text-xs leading-5">
                {item.copy.description}
              </span>
            </span>
          </a>
        {/each}
      </Card.Content>
    </Card.Root>
  </div>
</section>

<style>
  .mobile-app-preview-icon,
  .mobile-app-feature-icon,
  .mobile-app-link-icon {
    display: inline-flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
  }

  .mobile-app-preview-icon {
    width: 1rem;
    height: 1rem;
  }

  .mobile-app-feature-icon,
  .mobile-app-link-icon {
    width: 2rem;
    height: 2rem;
    border-width: 1px;
  }

  .mobile-app-preview-icon :global(svg) {
    width: 1rem;
    height: 1rem;
  }

  .mobile-app-feature-icon :global(svg),
  .mobile-app-link-icon :global(svg) {
    width: 1rem;
    height: 1rem;
  }
</style>
