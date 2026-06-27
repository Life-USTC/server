<script lang="ts">
import {
  type AdminDashboardCardData,
  type AdminDashboardCommonCopy,
  adminDashboardCards,
  adminDashboardQueueCards,
} from "@/features/admin/lib/admin-dashboard-card-data";
import PageHeader from "$lib/components/PageHeader.svelte";
import * as Breadcrumb from "$lib/components/ui/breadcrumb/index.js";

export let data: AdminDashboardCardData & {
  copy: AdminDashboardCardData["copy"] & {
    common: AdminDashboardCommonCopy;
    title: string;
  };
};

$: cards = adminDashboardCards(data);
$: queueCards = adminDashboardQueueCards(data);
</script>

<svelte:head><title>{data.copy.title} - Life@USTC</title></svelte:head>

<section class="grid gap-8">
  <PageHeader title={data.copy.title} description={data.copy.subtitle}>
    {#snippet breadcrumb()}
      <Breadcrumb.Root label={data.copy.common.breadcrumb}>
        <Breadcrumb.List>
          <Breadcrumb.Item>
            <Breadcrumb.Link href="/">{data.copy.common.home}</Breadcrumb.Link>
          </Breadcrumb.Item>
          <Breadcrumb.Separator />
          <Breadcrumb.Item>
            <Breadcrumb.Page>{data.copy.title}</Breadcrumb.Page>
          </Breadcrumb.Item>
        </Breadcrumb.List>
      </Breadcrumb.Root>
    {/snippet}
  </PageHeader>

  <div class="grid gap-3">
    <h2 class="text-sm font-medium text-base-content/60">
      {data.copy.dashboard.openItems}
    </h2>
    <div class="flex flex-wrap gap-3">
      {#each queueCards as queue}
        <a
          class="inline-flex items-center gap-2 rounded-md border border-base-200 px-3 py-1.5 text-sm text-base-content/80 transition hover:border-base-300 hover:bg-base-200/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          href={queue.href}
        >
          <span>{queue.label}</span>
          <span class="font-medium">{queue.value}</span>
        </a>
      {/each}
    </div>
  </div>

  <div class="grid gap-1">
    {#each cards as card}
      {@const Icon = card.icon}
      <a
        class="group flex items-start gap-4 rounded-lg p-3 no-underline transition hover:bg-base-200/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
        href={card.href}
      >
        <span
          class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border {card.iconTone}"
        >
          <Icon />
        </span>
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span class="font-medium">{card.label}</span>
            <span class="text-sm text-base-content/60">
              {card.value} · {card.meta}
            </span>
          </div>
          <p class="text-sm text-base-content/60">
            {card.description}
          </p>
        </div>
        <span
          class="ml-auto shrink-0 text-base-content/40 transition group-hover:text-base-content/70"
          aria-hidden="true"
        >
          →
        </span>
      </a>
    {/each}
  </div>
</section>
