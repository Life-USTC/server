<script lang="ts">
import AdminWorkspace from "@/features/admin/components/AdminWorkspace.svelte";
import {
  auditChannelLabel,
  auditFeatureLabel,
} from "@/features/admin/lib/admin-audit-display";
import PageHeader from "$lib/components/PageHeader.svelte";
import { Button } from "$lib/components/ui/button/index.js";
import * as Card from "$lib/components/ui/card/index.js";
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
    <Card.Root>
      <Card.Header><Card.Title>{data.copy.analytics.window}</Card.Title></Card.Header>
      <Card.Content class="flex flex-wrap gap-2">
        {#each [7, 30, 90] as days}
          <Button
            href={`/admin/analytics?days=${days}`}
            aria-current={data.days === days ? "page" : undefined}
            variant={data.days === days ? "default" : "outline"}
          >{daysLabel(days)}</Button>
        {/each}
      </Card.Content>
    </Card.Root>
  {/snippet}

  {#snippet summary()}
    <div class="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <Card.Root>
        <Card.Header class="gap-1">
          <Card.Description>{data.copy.analytics.total}</Card.Description>
          <Card.Title class="text-2xl tabular-nums">{numberFormatter.format(data.summary.total)}</Card.Title>
        </Card.Header>
      </Card.Root>
      <Card.Root>
        <Card.Header class="gap-1">
          <Card.Description>{data.copy.analytics.attention}</Card.Description>
          <Card.Title class="text-2xl tabular-nums">{numberFormatter.format(attention)}</Card.Title>
          <p class="text-xs text-muted-foreground">{data.copy.analytics.failureRate} {percentFormatter.format(failureRate)}</p>
        </Card.Header>
      </Card.Root>
      <Card.Root>
        <Card.Header class="gap-1">
          <Card.Description>{data.copy.analytics.externalShare}</Card.Description>
          <Card.Title class="text-2xl tabular-nums">{percentFormatter.format(externalShare)}</Card.Title>
        </Card.Header>
      </Card.Root>
      <Card.Root>
        <Card.Header class="gap-1">
          <Card.Description>{data.copy.analytics.activeClients}</Card.Description>
          <Card.Title class="text-2xl tabular-nums">{numberFormatter.format(data.summary.activeClients)}</Card.Title>
        </Card.Header>
      </Card.Root>
    </div>
  {/snippet}

  {#if data.summary.total === 0}
    <Card.Root><Card.Content class="p-6 text-sm text-muted-foreground">{data.copy.analytics.noData}</Card.Content></Card.Root>
  {:else}
    <Card.Root>
      <Card.Header>
        <Card.Title>{data.copy.analytics.trend}</Card.Title>
        <Card.Description>{data.copy.analytics.trendDescription}</Card.Description>
      </Card.Header>
      <Card.Content class="grid gap-4">
        <figure class="grid gap-3">
          <div class="flex flex-wrap gap-4 text-xs text-muted-foreground" aria-hidden="true">
            <span class="flex items-center gap-2"><span class="h-0.5 w-6 bg-primary"></span>{data.copy.analytics.totalSeries}</span>
            <span class="flex items-center gap-2"><span class="h-0.5 w-6 border-destructive border-t-2 border-dashed"></span>{data.copy.analytics.riskSeries}</span>
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
            <line x1="0" x2="720" y1="160" y2="160" class="stroke-border" />
            <polyline points={totalPoints} fill="none" class="stroke-primary" stroke-width="3" vector-effect="non-scaling-stroke" />
            <polyline points={riskPoints} fill="none" class="stroke-destructive" stroke-width="2" stroke-dasharray="6 5" vector-effect="non-scaling-stroke" />
          </svg>
          <figcaption class="flex justify-between text-xs text-muted-foreground">
            <span>{dayFormatter.format(new Date(`${data.daily[0].day}T00:00:00+08:00`))}</span>
            <span>{dayFormatter.format(new Date(`${data.daily.at(-1)?.day}T00:00:00+08:00`))}</span>
          </figcaption>
        </figure>
        <details class="rounded-md border px-3 py-2 text-sm">
          <summary class="cursor-pointer font-medium">{data.copy.analytics.dailyDetails}</summary>
          <div class="mt-3 max-h-72 overflow-auto">
            <table class="w-full text-left text-sm">
              <thead><tr class="border-b"><th class="py-2">{data.copy.audit.time}</th><th class="py-2 text-right">{data.copy.analytics.total}</th><th class="py-2 text-right">{data.copy.analytics.attention}</th></tr></thead>
              <tbody>
                {#each data.daily as entry}
                  <tr class="border-b last:border-0"><td class="py-2">{entry.day}</td><td class="py-2 text-right tabular-nums">{numberFormatter.format(entry.total)}</td><td class="py-2 text-right tabular-nums">{numberFormatter.format(entry.denied + entry.failure)}</td></tr>
                {/each}
              </tbody>
            </table>
          </div>
        </details>
      </Card.Content>
    </Card.Root>

    <section aria-labelledby="analytics-rankings-title" class="grid gap-3">
      <h2 id="analytics-rankings-title" class="text-lg font-semibold">{data.copy.analytics.rankings}</h2>
      <div class="grid gap-4 xl:grid-cols-3">
        {#each [
          { title: data.copy.analytics.topFeatures, kind: "feature", rows: data.rankings.features },
          { title: data.copy.analytics.topChannels, kind: "channel", rows: data.rankings.channels },
          { title: data.copy.analytics.topClients, kind: "client", rows: data.rankings.clients },
        ] as ranking}
          <Card.Root>
            <Card.Header><Card.Title class="text-base">{ranking.title}</Card.Title></Card.Header>
            <Card.Content>
              <ol class="grid gap-3">
                {#each ranking.rows as row}
                  <li class="grid gap-1.5">
                    <div class="flex items-baseline justify-between gap-3 text-sm">
                      <span class="truncate font-medium">{rankingLabel(ranking.kind as "channel" | "client" | "feature", row.label)}</span>
                      <span class="shrink-0 tabular-nums">{numberFormatter.format(row.count)}</span>
                    </div>
                    <div class="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                      <div class="h-full rounded-full bg-primary" style={`width: ${Math.max(2, (row.count / ranking.rows[0].count) * 100)}%`}></div>
                    </div>
                    {#if row.failures > 0}<span class="text-xs text-destructive">{failureLabel(row.failures)}</span>{/if}
                  </li>
                {/each}
              </ol>
            </Card.Content>
          </Card.Root>
        {/each}
      </div>
    </section>
  {/if}
</AdminWorkspace>
