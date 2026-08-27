<script lang="ts">
import AdminWorkspace from "@/features/admin/components/AdminWorkspace.svelte";
import {
  auditChannelLabel,
  auditFeatureLabel,
} from "@/features/admin/lib/admin-audit-display";
import PageHeader from "$lib/components/PageHeader.svelte";
import { Button } from "$lib/components/ui/button/index.js";
import * as Empty from "$lib/components/ui/empty/index.js";
import { Progress } from "$lib/components/ui/progress/index.js";
import * as Table from "$lib/components/ui/table/index.js";
import type { PageData } from "./$types";

export let data: PageData;

const numberFormatter = new Intl.NumberFormat(data.locale);
const percentFormatter = new Intl.NumberFormat(data.locale, {
  maximumFractionDigits: 1,
  style: "percent",
});
const dayFormatter = new Intl.DateTimeFormat(data.locale, {
  day: "numeric",
  month: "short",
  timeZone: "Asia/Shanghai",
});

$: attention = data.summary.denied + data.summary.failure;
$: failureRate = data.summary.total > 0 ? attention / data.summary.total : 0;
$: externalShare =
  data.summary.total > 0 ? data.summary.external / data.summary.total : 0;
$: chartMax = Math.max(1, ...data.daily.map((entry) => entry.total));
$: totalPoints = chartPoints((entry) => entry.total);
$: riskPoints = chartPoints((entry) => entry.denied + entry.failure);

function daysLabel(days: number) {
  return data.copy.analytics.days.replace("{days}", String(days));
}

function chartPoints(value: (entry: PageData["daily"][number]) => number) {
  const width = 720;
  const height = 160;
  const denominator = Math.max(data.daily.length - 1, 1);
  return data.daily
    .map((entry, index) => {
      const x = (index / denominator) * width;
      const y = height - (value(entry) / chartMax) * (height - 12);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

function rankingLabel(kind: "channel" | "client" | "feature", label: string) {
  if (kind === "channel") return auditChannelLabel(data.locale, label);
  if (kind === "feature") return auditFeatureLabel(data.locale, label);
  return label === "first-party" ? data.copy.analytics.firstParty : label;
}

function failureLabel(count: number) {
  return data.copy.analytics.failures.replace(
    "{count}",
    numberFormatter.format(count),
  );
}
</script>

<svelte:head><title>{data.copy.analytics.title} - Life@USTC</title></svelte:head>

<AdminWorkspace>
  {#snippet header()}
    <PageHeader
      title={data.copy.analytics.title}
      description={data.copy.analytics.subtitle}
      eyebrow={data.copy.admin.title}
    />
  {/snippet}

  {#snippet controls()}
    <section aria-labelledby="analytics-window-title" class="grid gap-3 border-y py-4 sm:grid-cols-[1fr_auto] sm:items-center">
      <h2 id="analytics-window-title" class="text-base font-semibold">
        {data.copy.analytics.window}
      </h2>
      <nav class="flex flex-wrap gap-2" aria-label={data.copy.analytics.window}>
        {#each [7, 30, 90] as days}
          <Button
            href={`/admin/analytics?days=${days}`}
            aria-current={data.days === days ? "page" : undefined}
            variant={data.days === days ? "default" : "outline"}
          >{daysLabel(days)}</Button>
        {/each}
      </nav>
    </section>
  {/snippet}

  {#snippet summary()}
    <dl class="grid grid-cols-2 gap-x-6 gap-y-5 border-y py-4 xl:grid-cols-4">
      <div class="grid content-start gap-1">
        <dt class="text-sm text-muted-foreground">{data.copy.analytics.total}</dt>
        <dd class="text-2xl font-semibold tabular-nums">{numberFormatter.format(data.summary.total)}</dd>
      </div>
      <div class="grid content-start gap-1">
        <dt class="text-sm text-muted-foreground">{data.copy.analytics.attention}</dt>
        <dd class="text-2xl font-semibold tabular-nums">{numberFormatter.format(attention)}</dd>
        <dd class="text-xs text-muted-foreground">{data.copy.analytics.failureRate} {percentFormatter.format(failureRate)}</dd>
      </div>
      <div class="grid content-start gap-1">
        <dt class="text-sm text-muted-foreground">{data.copy.analytics.externalShare}</dt>
        <dd class="text-2xl font-semibold tabular-nums">{percentFormatter.format(externalShare)}</dd>
      </div>
      <div class="grid content-start gap-1">
        <dt class="text-sm text-muted-foreground">{data.copy.analytics.activeClients}</dt>
        <dd class="text-2xl font-semibold tabular-nums">{numberFormatter.format(data.summary.activeClients)}</dd>
      </div>
    </dl>
  {/snippet}

  {#if data.summary.total === 0}
    <Empty.Root class="items-start border-y px-0 text-left">
      <Empty.Header class="items-start text-left">
        <Empty.Title>{data.copy.analytics.noData}</Empty.Title>
      </Empty.Header>
    </Empty.Root>
  {:else}
    <section aria-labelledby="analytics-trend-heading" class="grid gap-4 border-y py-5">
      <header class="grid gap-1">
        <h2 id="analytics-trend-heading" class="text-lg font-semibold">{data.copy.analytics.trend}</h2>
        <p class="text-sm text-muted-foreground">{data.copy.analytics.trendDescription}</p>
      </header>
      <div class="grid gap-4">
        <figure class="grid gap-3">
          <div class="flex flex-wrap gap-4 text-xs text-muted-foreground" aria-hidden="true">
            <span class="flex items-center gap-2"><span class="h-0.5 w-6 bg-primary"></span>{data.copy.analytics.totalSeries}</span>
            <span class="flex items-center gap-2"><span class="h-0.5 w-6 border-destructive border-t-2 border-dashed"></span>{data.copy.analytics.riskSeries}</span>
          </div>
          <div class="grid grid-cols-[auto_minmax(0,1fr)] gap-2">
            <div class="flex h-44 flex-col justify-between text-right text-xs tabular-nums text-muted-foreground" aria-hidden="true">
              <span>{numberFormatter.format(chartMax)}</span>
              <span>{numberFormatter.format(Math.round(chartMax / 2))}</span>
              <span>0</span>
            </div>
            <svg
              class="h-44 w-full overflow-visible"
              viewBox="0 0 720 170"
              role="img"
              aria-labelledby="analytics-trend-title analytics-trend-description"
              preserveAspectRatio="none"
            >
              <title id="analytics-trend-title">{data.copy.analytics.trend}</title>
              <desc id="analytics-trend-description">{data.copy.analytics.trendDescription}</desc>
              <line x1="0" x2="720" y1="12" y2="12" class="stroke-border" />
              <line x1="0" x2="720" y1="86" y2="86" class="stroke-border" />
              <line x1="0" x2="720" y1="160" y2="160" class="stroke-border" />
              <polyline points={totalPoints} fill="none" class="stroke-primary" stroke-width="3" vector-effect="non-scaling-stroke" />
              <polyline points={riskPoints} fill="none" class="stroke-destructive" stroke-width="2" stroke-dasharray="6 5" vector-effect="non-scaling-stroke" />
            </svg>
          </div>
          <figcaption class="flex justify-between text-xs text-muted-foreground">
            <span>{dayFormatter.format(new Date(`${data.daily[0].day}T00:00:00+08:00`))}</span>
            <span>{dayFormatter.format(new Date(`${data.daily.at(-1)?.day}T00:00:00+08:00`))}</span>
          </figcaption>
        </figure>
        <details class="rounded-md border px-3 py-2 text-sm">
          <summary class="cursor-pointer font-medium">{data.copy.analytics.dailyDetails}</summary>
          <div class="mt-3 max-h-72 overflow-auto">
            <Table.Root>
              <Table.Caption class="sr-only">{data.copy.analytics.dailyDetails}</Table.Caption>
              <Table.Header>
                <Table.Row>
                  <Table.Head>{data.copy.audit.time}</Table.Head>
                  <Table.Head class="text-right">{data.copy.analytics.total}</Table.Head>
                  <Table.Head class="text-right">{data.copy.analytics.attention}</Table.Head>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {#each data.daily as entry}
                  <Table.Row>
                    <Table.Cell>{entry.day}</Table.Cell>
                    <Table.Cell class="text-right tabular-nums">{numberFormatter.format(entry.total)}</Table.Cell>
                    <Table.Cell class="text-right tabular-nums">{numberFormatter.format(entry.denied + entry.failure)}</Table.Cell>
                  </Table.Row>
                {/each}
              </Table.Body>
            </Table.Root>
          </div>
        </details>
      </div>
    </section>

    <section aria-labelledby="analytics-rankings-title" class="grid gap-3">
      <h2 id="analytics-rankings-title" class="text-lg font-semibold">{data.copy.analytics.rankings}</h2>
      <div class="grid divide-y border-y xl:grid-cols-3 xl:divide-x xl:divide-y-0">
        {#each [
          { title: data.copy.analytics.topFeatures, kind: "feature", rows: data.rankings.features },
          { title: data.copy.analytics.topChannels, kind: "channel", rows: data.rankings.channels },
          { title: data.copy.analytics.topClients, kind: "client", rows: data.rankings.clients },
        ] as ranking}
          <section class="grid content-start gap-4 py-5 xl:px-5 xl:first:pl-0 xl:last:pr-0">
            <h3 class="text-base font-semibold">{ranking.title}</h3>
            <ol class="grid gap-3">
              {#each ranking.rows as row}
                <li class="grid gap-1.5">
                  <div class="flex items-baseline justify-between gap-3 text-sm">
                    <span class="truncate font-medium">{rankingLabel(ranking.kind as "channel" | "client" | "feature", row.label)}</span>
                    <span class="shrink-0 tabular-nums">{numberFormatter.format(row.count)}</span>
                  </div>
                  <Progress
                    aria-label={`${rankingLabel(ranking.kind as "channel" | "client" | "feature", row.label)}: ${numberFormatter.format(row.count)}`}
                    class="h-1.5"
                    max={ranking.rows[0]?.count ?? 1}
                    value={row.count}
                  />
                  {#if row.failures > 0}<span class="text-xs text-destructive">{failureLabel(row.failures)}</span>{/if}
                </li>
              {/each}
            </ol>
          </section>
        {/each}
      </div>
    </section>
  {/if}
</AdminWorkspace>
