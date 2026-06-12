<script lang="ts">
import ArrowUpRight from "$lib/components/icons/arrow-up-right.svelte";
import Calendar from "$lib/components/icons/calendar.svelte";
import LayoutDashboard from "$lib/components/icons/layout-dashboard.svelte";
import Users from "$lib/components/icons/users.svelte";
import { Badge } from "$lib/components/ui/badge/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import * as Card from "$lib/components/ui/card/index.js";

type PageData = {
  copy: {
    homepage: {
      actions: { openDashboard: string };
      appIconAlt: string;
      badge: string;
      downloadBadgeAlt: string;
      quickAccess: {
        browseTeachers: { description: string; title: string };
        openDashboard: { description: string; title: string };
        title: string;
        viewSections: { description: string; title: string };
      };
      subtitle: string;
      title: { line1: string; line2: string };
    };
    metadata: { mobileApp: string };
  };
};

export let data: PageData;

$: copy = data.copy.homepage;
$: quickLinks = [
  {
    href: "/",
    title: copy.quickAccess.openDashboard.title,
    description: copy.quickAccess.openDashboard.description,
    icon: LayoutDashboard,
  },
  {
    href: "/sections",
    title: copy.quickAccess.viewSections.title,
    description: copy.quickAccess.viewSections.description,
    icon: Calendar,
  },
  {
    href: "/teachers",
    title: copy.quickAccess.browseTeachers.title,
    description: copy.quickAccess.browseTeachers.description,
    icon: Users,
  },
];
</script>

<svelte:head><title>{data.copy.metadata.mobileApp} - Life@USTC</title></svelte:head>

<section class="-mx-4 border-base-300 border-b px-4 pb-10 md:mx-0 md:px-0 md:pb-12">
  <div class="grid gap-10 pt-4 lg:grid-cols-[minmax(0,1.15fr)_20rem] lg:items-start">
    <div class="grid gap-6">
      <div class="grid gap-4">
        <Badge class="w-fit" variant="outline">{copy.badge}</Badge>
        <h1 class="max-w-3xl font-semibold text-4xl tracking-normal md:text-5xl">
          <span class="block">{copy.title.line1}</span>
          <span class="block text-primary">{copy.title.line2}</span>
        </h1>
        <p class="max-w-2xl text-base-content/60 text-lg leading-8">
          {copy.subtitle}
        </p>
      </div>

      <div class="flex flex-wrap items-center gap-4">
        <a
          class="inline-flex rounded-md no-underline transition hover:opacity-90"
          href="https://apps.apple.com/us/app/life-ustc/id1660437438"
          target="_blank"
          rel="noreferrer"
        >
          <img src="/images/appstore.svg" alt={copy.downloadBadgeAlt} width="150" height="44" />
        </a>
        <Button href="/" variant="outline">
          <LayoutDashboard />
          {copy.actions.openDashboard}
        </Button>
      </div>
    </div>

    <Card.Root>
      <Card.Content class="grid gap-4 p-5">
        <div class="flex items-center gap-4 border-base-300 border-b pb-4">
          <img class="h-14 w-14 rounded-md border border-base-300 bg-base-100" src="/images/icon.png" alt={copy.appIconAlt} />
          <div class="min-w-0">
            <p class="font-medium text-sm">{copy.quickAccess.title}</p>
            <p class="text-base-content/60 text-sm leading-6">{copy.subtitle}</p>
          </div>
        </div>

        <div class="grid gap-1.5">
          {#each quickLinks as item}
            <a
              class="group flex items-start gap-3 rounded-md border border-transparent px-3 py-3 no-underline transition hover:border-base-300 hover:bg-base-200/60"
              href={item.href}
            >
              <span class="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-base-300 bg-base-100 text-primary">
                <svelte:component this={item.icon} />
              </span>
              <span class="min-w-0 flex-1">
                <span class="flex items-start justify-between gap-3">
                  <span class="font-medium text-sm leading-6">{item.title}</span>
                  <ArrowUpRight class="mt-1 h-3.5 w-3.5 shrink-0 text-base-content/45 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </span>
                <span class="mt-0.5 block text-base-content/60 text-sm leading-6">{item.description}</span>
              </span>
            </a>
          {/each}
        </div>
      </Card.Content>
    </Card.Root>
  </div>
</section>
