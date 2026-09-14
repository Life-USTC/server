<script lang="ts">
import DailySeriesChart from "$lib/components/charts/DailySeriesChart.svelte";
import type { DailySeries } from "$lib/components/charts/daily-series";
import * as Alert from "$lib/components/ui/alert/index.js";
import * as Empty from "$lib/components/ui/empty/index.js";
import type messages from "../../../../messages/en-us.json";
import type {
  AdminUserTrendDailyRow,
  readAdminUserTrends,
} from "../server/admin-user-trends";

type UserTrendsCopy = typeof messages.adminUserTrends;
type UserTrendsData = Awaited<ReturnType<typeof readAdminUserTrends>>;

export let data: UserTrendsData;
export let copy: UserTrendsCopy;
export let locale = "en-us";

$: numberFormatter = new Intl.NumberFormat(locale);
$: chartSeries = buildChartSeries(data.daily, copy);
$: days = data.daily.map((entry) => entry.day);
$: partialDays = data.daily.map((entry) => entry.partial);

function buildChartSeries(
  daily: readonly AdminUserTrendDailyRow[],
  labels: UserTrendsCopy,
): DailySeries[] {
  return [
    {
      key: "registered-users",
      label: labels.registrationsSeries,
      values: daily.map((entry) => entry.registeredUsers),
    },
    {
      key: "active-users",
      label: labels.activeUsersSeries,
      values: daily.map((entry) => entry.activeUsers),
    },
  ];
}

function count(value: number | null) {
  return value === null ? "—" : numberFormatter.format(value);
}
</script>

<section aria-labelledby="admin-user-trends-title" class="grid min-w-0 gap-4 border-y py-5">
  <header class="grid gap-1">
    <h2 id="admin-user-trends-title" class="text-lg font-semibold">{copy.title}</h2>
    <p class="text-sm text-muted-foreground">{copy.subtitle}</p>
  </header>

  {#if data.status.state === "unavailable"}
    <Alert.Root variant="destructive">
      <Alert.Title>{copy.unavailable}</Alert.Title>
      <Alert.Description>{copy.unavailableDescription}</Alert.Description>
    </Alert.Root>
  {:else}
    <div class="grid gap-2 text-sm text-muted-foreground">
      <p>{copy.retainedAccountsNote}</p>
      <p>{copy.identifiedActivityNote}</p>
    </div>

    <dl class="grid grid-cols-1 gap-x-6 gap-y-5 border-y py-4 sm:grid-cols-3">
      <div class="grid content-start gap-1">
        <dt class="text-sm text-muted-foreground">{copy.currentUsers}</dt>
        <dd class="text-2xl font-semibold tabular-nums">{count(data.summary.currentUsers)}</dd>
      </div>
      <div class="grid content-start gap-1">
        <dt class="text-sm text-muted-foreground">{copy.periodRegisteredUsers}</dt>
        <dd class="text-2xl font-semibold tabular-nums">{count(data.summary.periodRegisteredUsers)}</dd>
      </div>
      <div class="grid content-start gap-1">
        <dt class="text-sm text-muted-foreground">{copy.periodActiveUsers}</dt>
        <dd class="text-2xl font-semibold tabular-nums">{count(data.summary.periodActiveUsers)}</dd>
        {#if data.summary.periodActiveUsers === null}
          <dd class="text-xs text-muted-foreground">{copy.noActivity}</dd>
        {/if}
      </div>
    </dl>

    {#if data.daily.every((entry) => entry.registeredUsers === 0 && entry.activeUsers === null)}
      <Empty.Root class="items-start border-y px-0 text-left">
        <Empty.Header class="items-start text-left">
          <Empty.Title>{copy.noData}</Empty.Title>
        </Empty.Header>
      </Empty.Root>
    {:else}
      <DailySeriesChart
        id="admin-user-trends-chart"
        days={days}
        series={chartSeries}
        partialDays={partialDays}
        locale={locale}
        title={copy.title}
        description={copy.trendDescription}
        labels={{
          dataTable: copy.chartDataTable,
          day: copy.chartDay,
          inspect: copy.chartInspect,
          legend: copy.chartLegend,
          noData: copy.noData,
          partial: copy.partialDay,
          value: copy.chartValue,
        }}
      />
    {/if}
  {/if}
</section>
