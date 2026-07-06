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
import * as Item from "$lib/components/ui/item/index.js";

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
      <Card.Header class="p-4 sm:p-5">
        <div class="flex min-w-0 items-center gap-3">
          <img
            class="size-12 rounded-md border border-border bg-background"
            src="/images/icon.png"
            alt={homeCopy.appIconAlt}
          />
          <div class="min-w-0">
            <p class="font-medium text-muted-foreground text-xs uppercase tracking-normal">
              {pageCopy.eyebrow}
            </p>
            <h1 class="font-semibold text-2xl leading-tight tracking-normal sm:text-3xl">
              {pageCopy.title}
            </h1>
          </div>
        </div>
        <Card.Action>
          <Badge variant="outline">{pageCopy.availability}</Badge>
        </Card.Action>
        <Card.Description class="max-w-3xl">
          {pageCopy.subtitle}
        </Card.Description>
      </Card.Header>

      <Card.Content class="grid gap-5 px-4 sm:px-5">
        <Item.Group class="grid gap-2 sm:grid-cols-3">
          {#each stats as item}
            <Item.Root class="items-start" size="sm" variant="muted">
              <Item.Content>
                <Item.Title>{item.value}</Item.Title>
                <Item.Description>{item.label}</Item.Description>
              </Item.Content>
            </Item.Root>
          {/each}
        </Item.Group>
      </Card.Content>

      <Card.Footer class="flex-wrap gap-2 px-4 sm:px-5">
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
      </Card.Footer>
    </Card.Root>

    <Card.Root class="overflow-hidden">
      <Card.Header class="p-4">
        <div class="flex items-center gap-3">
          <Item.Media variant="icon">
            <SmartphoneIcon />
          </Item.Media>
          <div class="min-w-0">
            <Card.Title class="truncate">{pageCopy.previewTitle}</Card.Title>
            <Card.Description>{pageCopy.previewSubtitle}</Card.Description>
          </div>
        </div>
      </Card.Header>
      <Card.Content class="grid gap-3 p-4">
        <Item.Root variant="muted">
          <Item.Media variant="icon">
            <BellIcon />
          </Item.Media>
          <Item.Content>
            <Item.Title>{pageCopy.previewStatusTitle}</Item.Title>
            <Item.Description>{pageCopy.previewStatusDescription}</Item.Description>
          </Item.Content>
        </Item.Root>

        <Item.Group class="gap-2">
          {#each previewItems as item}
            <Item.Root size="sm" variant="outline">
              <Item.Media variant="icon">
                <svelte:component this={item.icon} />
              </Item.Media>
              <Item.Content>
                <Item.Title>{item.label}</Item.Title>
              </Item.Content>
              <Item.Actions class="shrink-0">
                {item.status}
              </Item.Actions>
            </Item.Root>
          {/each}
        </Item.Group>
      </Card.Content>
    </Card.Root>
  </div>

  <div class="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start">
    <Card.Root>
      <Card.Header class="p-4 pb-0 sm:p-5 sm:pb-0">
        <Card.Title>{pageCopy.featureTitle}</Card.Title>
      </Card.Header>
      <Card.Content class="p-4 sm:p-5">
        <Item.Group class="grid gap-2 sm:grid-cols-2">
          {#each featureItems as item}
            <Item.Root class="items-start" variant="outline">
              <Item.Media variant="icon">
                <svelte:component this={item.icon} />
              </Item.Media>
              <Item.Content>
                <Item.Title>{item.copy.title}</Item.Title>
                <Item.Description>{item.copy.description}</Item.Description>
              </Item.Content>
            </Item.Root>
          {/each}
        </Item.Group>
      </Card.Content>
    </Card.Root>

    <Card.Root>
      <Card.Header class="p-4 pb-0">
        <Card.Title>{pageCopy.quickLinksTitle}</Card.Title>
      </Card.Header>
      <Card.Content class="p-4">
        <Item.Group class="gap-1.5">
          {#each quickLinks as item}
            <Item.Root size="sm">
              {#snippet child({ props })}
                <a {...props} href={item.href}>
                  <Item.Media variant="icon">
                    <svelte:component this={item.icon} />
                  </Item.Media>
                  <Item.Content>
                    <Item.Title>{item.copy.title}</Item.Title>
                    <Item.Description>{item.copy.description}</Item.Description>
                  </Item.Content>
                  <Item.Actions>
                    <ExternalLinkIcon />
                  </Item.Actions>
                </a>
              {/snippet}
            </Item.Root>
          {/each}
        </Item.Group>
      </Card.Content>
    </Card.Root>
  </div>
</section>
