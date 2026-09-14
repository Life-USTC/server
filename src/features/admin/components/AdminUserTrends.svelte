<script lang="ts">
import DailySeriesChart from "$lib/components/charts/DailySeriesChart.svelte";
import type { DailySeries } from "$lib/components/charts/daily-series";
import DashboardPanel from "$lib/components/dashboard/DashboardPanel.svelte";
import StatPanels from "$lib/components/dashboard/StatPanels.svelte";
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

<DashboardPanel id="admin-user-trends" title={copy.title} description={copy.subtitle}>
  {#if data.status.state === "unavailable"}
    <Alert.Root variant="destructive">
      <Alert.Title>{copy.unavailable}</Alert.Title>
      <Alert.Description>{copy.unavailableDescription}</Alert.Description>
    </Alert.Root>
  {:else}
    <div class="grid gap-3">
      <div class="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2 sm:gap-4">
        <p>{copy.retainedAccountsNote}</p>
        <p>{copy.identifiedActivityNote}</p>
      </div>

      <StatPanels
        items={[
          { label: copy.currentUsers, value: count(data.summary.currentUsers) },
          {
            label: copy.periodRegisteredUsers,
            value: count(data.summary.periodRegisteredUsers),
          },
          {
            label: copy.periodActiveUsers,
            value: count(data.summary.periodActiveUsers),
            hint: data.summary.periodActiveUsers === null ? copy.noActivity : undefined,
          },
        ]}
      />
    </div>

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
</DashboardPanel>
