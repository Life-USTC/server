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
import DashboardPanel from "$lib/components/dashboard/DashboardPanel.svelte";
import StatPanels from "$lib/components/dashboard/StatPanels.svelte";
import PageHeader from "$lib/components/PageHeader.svelte";
import { Button } from "$lib/components/ui/button/index.js";
import * as Empty from "$lib/components/ui/empty/index.js";
import * as Field from "$lib/components/ui/field/index.js";
import * as NativeSelect from "$lib/components/ui/native-select/index.js";
import { Progress } from "$lib/components/ui/progress/index.js";
import * as Table from "$lib/components/ui/table/index.js";
import * as Tabs from "$lib/components/ui/tabs/index.js";
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

<AdminWorkspace compact>
  {#snippet header()}
    <PageHeader title={data.copy.analytics.title} />
  {/snippet}

  {#snippet controls()}
    <DashboardPanel id="analytics-window" title={data.copy.analytics.window} description={data.copy.analytics.subtitle}>
      <Field.Group class="grid gap-2 sm:grid-cols-[auto_1fr] sm:items-center">
        <p class="text-xs text-muted-foreground">{data.copy.analytics.trendDescription}</p>
        <nav class="flex flex-wrap gap-2 sm:justify-end" aria-label={data.copy.analytics.window}>
          {#each [7, 30, 90] as days}
            <Button
              size="sm"
              href={periodHref(data, days)}
              aria-current={data.days === days ? "page" : undefined}
              variant={data.days === days ? "default" : "outline"}
            >{daysLabel(days)}</Button>
          {/each}
        </nav>
      </Field.Group>
    </DashboardPanel>
  {/snippet}

  {#snippet summary()}
    <StatPanels
      items={[
        {
          label: data.copy.analytics.total,
          value: numberFormatter.format(data.summary.total),
        },
        {
          label: data.copy.analytics.attention,
          value: numberFormatter.format(attention),
          hint: `${data.copy.analytics.failureRate} ${percentFormatter.format(failureRate)}`,
        },
        {
          label: data.copy.analytics.externalShare,
          value: percentFormatter.format(externalShare),
        },
        {
          label: data.copy.analytics.activeClients,
          value: numberFormatter.format(data.summary.activeClients),
        },
      ]}
    />
  {/snippet}

  <AdminUserTrends data={data.userTrends} copy={data.copy.userTrends} locale={data.locale} />

  <Tabs.Root value="feature" class="min-w-0 gap-4">
    <Tabs.List aria-label={data.copy.analytics.title} class="w-full sm:w-fit">
      <Tabs.Trigger value="feature">{data.copy.telemetry.title}</Tabs.Trigger>
      <Tabs.Trigger value="history">{data.copy.analytics.title}</Tabs.Trigger>
    </Tabs.List>

    <Tabs.Content value="feature" class="grid min-w-0 gap-4">
      <AdminFeatureTelemetry data={{...data.telemetry, locale: data.locale, copy: {experience: data.copy.telemetry}}} />
    </Tabs.Content>

    <Tabs.Content value="history" class="grid min-w-0 gap-4">
      {#if data.summary.total === 0}
        <Empty.Root class="items-start border-y px-0 text-left">
          <Empty.Header class="items-start text-left">
            <Empty.Title>{data.copy.analytics.noData}</Empty.Title>
          </Empty.Header>
        </Empty.Root>
      {:else}
        <DashboardPanel
          id="analytics-trend-filter"
          title={data.copy.analytics.trend}
          description={data.copy.analytics.trendDescription}
        >
          <Field.Group class="grid gap-2 sm:max-w-sm">
            <Field.Field>
              <Field.Label for="analytics-trend-feature">{data.copy.analytics.featureFilter}</Field.Label>
              <NativeSelect.Root id="analytics-trend-feature" bind:value={selectedTrendFeature}>
                <NativeSelect.Option value="">{data.copy.analytics.allFeatures}</NativeSelect.Option>
                {#each trendFeatureOptions as feature}
                  <NativeSelect.Option value={feature}>{auditFeatureLabel(data.locale, feature)}</NativeSelect.Option>
                {/each}
              </NativeSelect.Root>
            </Field.Field>
          </Field.Group>
        </DashboardPanel>

        <section aria-labelledby="analytics-trend-heading" class="grid min-w-0 gap-3">
          <header class="grid gap-1">
            <h2 id="analytics-trend-heading" class="text-base font-semibold">{data.copy.analytics.trend}</h2>
            <p class="text-sm text-muted-foreground">{data.copy.analytics.trendDescription}</p>
          </header>
          <div class="grid min-w-0 gap-4 lg:grid-cols-2">
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
        </section>

        <DashboardPanel id="analytics-daily-details" title={data.copy.analytics.dailyDetails}>
          <details class="grid gap-3">
            <summary class="cursor-pointer text-sm font-medium">{data.copy.analytics.dailyDetails}</summary>
            <div class="max-h-72 overflow-auto">
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
        </DashboardPanel>

        <section aria-labelledby="analytics-rankings-title" class="grid min-w-0 gap-3">
          <h2 id="analytics-rankings-title" class="text-base font-semibold">{data.copy.analytics.rankings}</h2>
          <div class="grid min-w-0 gap-4 lg:grid-cols-3">
            {#each [
              { title: data.copy.analytics.topFeatures, kind: "feature", rows: data.rankings.features },
              { title: data.copy.analytics.topChannels, kind: "channel", rows: data.rankings.channels },
              { title: data.copy.analytics.topClients, kind: "client", rows: data.rankings.clients },
            ] as ranking}
              <DashboardPanel title={ranking.title}>
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
              </DashboardPanel>
            {/each}
          </div>
        </section>
      {/if}
    </Tabs.Content>
  </Tabs.Root>
</AdminWorkspace>
