<script lang="ts">
import AdminFeatureTelemetry from "@/features/admin/components/AdminFeatureTelemetry.svelte";
import AdminUserTrends from "@/features/admin/components/AdminUserTrends.svelte";
import AdminWorkspace from "@/features/admin/components/AdminWorkspace.svelte";
import {
  auditActionLabel,
  auditChannelLabel,
  auditFeatureLabel,
} from "@/features/admin/lib/admin-audit-display";
import DailySeriesChart from "$lib/components/charts/DailySeriesChart.svelte";
import type { DailySeries } from "$lib/components/charts/daily-series";
import PageHeader from "$lib/components/PageHeader.svelte";
import { Button } from "$lib/components/ui/button/index.js";
import * as Empty from "$lib/components/ui/empty/index.js";
import * as NativeSelect from "$lib/components/ui/native-select/index.js";
import { Progress } from "$lib/components/ui/progress/index.js";
import * as Table from "$lib/components/ui/table/index.js";
import type { PageData } from "./$types";

export let data: PageData;

$: numberFormatter = new Intl.NumberFormat(data.locale);
$: percentFormatter = new Intl.NumberFormat(data.locale, {
  maximumFractionDigits: 1,
  style: "percent",
});

$: attention = data.summary.denied + data.summary.failure;
$: failureRate = data.summary.total > 0 ? attention / data.summary.total : 0;
$: externalShare =
  data.summary.total > 0 ? data.summary.external / data.summary.total : 0;

let selectedTrendFeature = "";
$: trendFeatureOptions = [
  ...new Set(data.trends.map((entry) => entry.feature)),
].sort();
$: if (
  selectedTrendFeature &&
  !trendFeatureOptions.includes(selectedTrendFeature)
) {
  selectedTrendFeature = "";
}
$: filteredTrendRows = selectedTrendFeature
  ? data.trends.filter((entry) => entry.feature === selectedTrendFeature)
  : data.trends;
$: operationSeries = buildTrendSeries("operation", filteredTrendRows, data);
$: channelSeries = buildTrendSeries("channel", filteredTrendRows, data);

function daysLabel(days: number) {
  return data.copy.analytics.days.replace("{days}", String(days));
}

function buildTrendSeries(
  kind: "operation" | "channel",
  rows: PageData["trends"],
  current: PageData,
): DailySeries[] {
  const totals = new Map<string, number>();
  for (const entry of rows) {
    totals.set(entry[kind], (totals.get(entry[kind]) ?? 0) + entry.count);
  }
  const keys = [...new Set(rows.map((entry) => entry[kind]))].sort(
    (left, right) =>
      (totals.get(right) ?? 0) - (totals.get(left) ?? 0) ||
      left.localeCompare(right),
  );
  return keys.map((key) => {
    const byDay = new Map<string, number>();
    for (const entry of rows) {
      if (entry[kind] !== key) continue;
      byDay.set(entry.day, (byDay.get(entry.day) ?? 0) + entry.count);
    }
    return {
      key,
      label:
        kind === "channel"
          ? auditChannelLabel(current.locale, key)
          : key === "read"
            ? current.copy.analytics.readOperation
            : key === "write"
              ? current.copy.analytics.writeOperation
              : auditActionLabel(current.locale, key),
      values: current.daily.map((entry) => byDay.get(entry.day) ?? 0),
    };
  });
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
function periodHref(current: PageData, days: number) {
  const params = new URLSearchParams({ days: String(days) });
  for (const [key, value] of Object.entries(current.telemetry.filters)) {
    if (value) params.set(key, value);
  }
  return `/admin/analytics?${params}`;
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
      <div class="grid gap-3">
        <h2 id="analytics-window-title" class="text-base font-semibold">
          {data.copy.analytics.window}
        </h2>
      </div>
      <nav class="flex flex-wrap gap-2" aria-label={data.copy.analytics.window}>
        {#each [7, 30, 90] as days}
          <Button
            href={periodHref(data, days)}
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

  <AdminUserTrends data={data.userTrends} copy={data.copy.userTrends} locale={data.locale} />

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
      <div class="grid gap-5">
        <div class="grid gap-2 sm:max-w-sm">
          <label for="analytics-trend-feature" class="text-sm font-medium">{data.copy.analytics.featureFilter}</label>
          <NativeSelect.Root id="analytics-trend-feature" bind:value={selectedTrendFeature}>
            <NativeSelect.Option value="">{data.copy.analytics.allFeatures}</NativeSelect.Option>
            {#each trendFeatureOptions as feature}
              <NativeSelect.Option value={feature}>{auditFeatureLabel(data.locale, feature)}</NativeSelect.Option>
            {/each}
          </NativeSelect.Root>
        </div>
        <div class="grid gap-8 xl:grid-cols-2">
          <DailySeriesChart
            id="analytics-operation-trend"
            days={data.daily.map((entry) => entry.day)}
            series={operationSeries}
            partialDays={data.daily.map((entry) => entry.partial)}
            locale={data.locale}
            title={data.copy.analytics.operationTrend}
            description={data.copy.analytics.operationTrendDescription}
            labels={{
              dataTable: data.copy.analytics.chartDataTable,
              day: data.copy.analytics.chartDay,
              inspect: data.copy.analytics.chartInspect,
              legend: data.copy.analytics.chartLegend,
              noData: data.copy.analytics.chartNoData,
              partial: data.copy.analytics.partialDay,
              value: data.copy.analytics.chartValue,
            }}
          />
          <DailySeriesChart
            id="analytics-channel-trend"
            days={data.daily.map((entry) => entry.day)}
            series={channelSeries}
            partialDays={data.daily.map((entry) => entry.partial)}
            locale={data.locale}
            title={data.copy.analytics.channelTrend}
            description={data.copy.analytics.channelTrendDescription}
            labels={{
              dataTable: data.copy.analytics.chartDataTable,
              day: data.copy.analytics.chartDay,
              inspect: data.copy.analytics.chartInspect,
              legend: data.copy.analytics.chartLegend,
              noData: data.copy.analytics.chartNoData,
              partial: data.copy.analytics.partialDay,
              value: data.copy.analytics.chartValue,
            }}
          />
        </div>
      </div>
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
                  <Table.Cell>{entry.day}{entry.partial ? ` (${data.copy.analytics.partialDay})` : ""}</Table.Cell>
                  <Table.Cell class="text-right tabular-nums">{numberFormatter.format(entry.total)}</Table.Cell>
                  <Table.Cell class="text-right tabular-nums">{numberFormatter.format(entry.denied + entry.failure)}</Table.Cell>
                </Table.Row>
              {/each}
            </Table.Body>
          </Table.Root>
        </div>
      </details>
    </section>

    <section aria-labelledby="analytics-rankings-title" class="grid min-w-0 gap-3">
      <h2 id="analytics-rankings-title" class="text-lg font-semibold">{data.copy.analytics.rankings}</h2>
      <div class="grid min-w-0 divide-y border-y xl:grid-cols-3 xl:divide-x xl:divide-y-0">
        {#each [
          { title: data.copy.analytics.topFeatures, kind: "feature", rows: data.rankings.features },
          { title: data.copy.analytics.topChannels, kind: "channel", rows: data.rankings.channels },
          { title: data.copy.analytics.topClients, kind: "client", rows: data.rankings.clients },
        ] as ranking}
          <section class="grid min-w-0 content-start gap-4 py-5 xl:px-5 xl:first:pl-0 xl:last:pr-0">
            <h3 class="text-base font-semibold">{ranking.title}</h3>
            <ol class="grid min-w-0 gap-3">
              {#each ranking.rows as row}
                <li class="grid min-w-0 gap-1.5">
                  <div class="flex min-w-0 items-baseline justify-between gap-3 text-sm">
                    <span class="min-w-0 truncate font-medium" title={rankingLabel(ranking.kind as "channel" | "client" | "feature", row.label)}>{rankingLabel(ranking.kind as "channel" | "client" | "feature", row.label)}</span>
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
<AdminFeatureTelemetry data={{...data.telemetry, locale: data.locale, copy: {experience: data.copy.telemetry}}} />
</AdminWorkspace>
