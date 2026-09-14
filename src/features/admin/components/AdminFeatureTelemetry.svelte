<script lang="ts">
import AdminListShell from "@/features/admin/components/AdminListShell.svelte";
import AdminTableShell from "@/features/admin/components/AdminTableShell.svelte";
import DailySeriesChart from "$lib/components/charts/DailySeriesChart.svelte";
import * as Alert from "$lib/components/ui/alert/index.js";
import { Badge } from "$lib/components/ui/badge/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import * as Empty from "$lib/components/ui/empty/index.js";
import * as Field from "$lib/components/ui/field/index.js";
import { Input } from "$lib/components/ui/input/index.js";
import * as Item from "$lib/components/ui/item/index.js";
import * as NativeSelect from "$lib/components/ui/native-select/index.js";
import * as Table from "$lib/components/ui/table/index.js";
import type messages from "../../../../messages/en-us.json";
import type { readAdminFeatureTelemetry } from "../server/admin-experience-page-data";

type BackendTelemetry = Awaited<ReturnType<typeof readAdminFeatureTelemetry>>;
type PageData = BackendTelemetry & {
  locale: string;
  copy: { experience: typeof messages.adminExperience };
};
type DailySeries = {
  key: string;
  label: string;
  values: readonly (number | null)[];
};

export let data: PageData;

$: page = data;
$: numberFormatter = new Intl.NumberFormat(page.locale);
$: durationFormatter = new Intl.NumberFormat(page.locale, {
  maximumFractionDigits: 1,
});
$: dateFormatter = new Intl.DateTimeFormat(page.locale, {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Shanghai",
});
$: chartDays = buildChartDays(
  page.coverage.fromDay,
  page.coverage.endDayExclusive,
  page.daily,
);
$: partialDays = chartDays.map(
  (day) => nextShanghaiDay(day) === page.coverage.endDayExclusive,
);
$: operationSeries = buildSeries(
  "operation",
  page.daily,
  page.filters.feature,
  chartDays,
  page.coverage.firstRecordedAt,
  page.copy.experience.protocols as Record<string, string>,
);
$: protocolSeries = buildSeries(
  "protocol",
  page.daily,
  page.filters.feature,
  chartDays,
  page.coverage.firstRecordedAt,
  page.copy.experience.protocols as Record<string, string>,
);

function label(group: string, value: string) {
  const labels = (page.copy.experience as Record<string, unknown>)[group];
  if (!labels || typeof labels !== "object" || Array.isArray(labels)) {
    return value;
  }
  const translated = (labels as Record<string, unknown>)[value];
  return typeof translated === "string" ? translated : value;
}

function metric(value: number | null) {
  return value === null ? "—" : durationFormatter.format(value);
}

function metricWithUnit(value: number | null) {
  return value === null ? "—" : `${metric(value)} ms`;
}

function nextShanghaiDay(day: string) {
  const value = new Date(`${day}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + 1);
  return value.toISOString().slice(0, 10);
}

function buildChartDays(
  fromDay: string,
  endDayExclusive: string,
  rows: PageData["daily"],
) {
  const days: string[] = [];
  let day = fromDay;
  let guard = 0;
  while (day < endDayExclusive && guard < 91) {
    days.push(day);
    day = nextShanghaiDay(day);
    guard += 1;
  }
  for (const row of rows) {
    if (!days.includes(row.day)) days.push(row.day);
  }
  return days.sort();
}

function recordedDay(value: string | null) {
  if (!value) return null;
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Shanghai",
    year: "numeric",
  }).formatToParts(timestamp);
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  return `${values.year}-${values.month}-${values.day}`;
}

function buildSeries(
  group: "operation" | "protocol",
  rows: PageData["daily"],
  selectedFeature: string | undefined,
  days: readonly string[],
  firstRecordedAt: string | null,
  protocolLabels: Record<string, string>,
): DailySeries[] {
  const firstDay = recordedDay(firstRecordedAt);
  const grouped = new Map<string, Map<string, number>>();
  for (const row of rows) {
    if (selectedFeature && row.feature !== selectedFeature) continue;
    const key = row[group];
    const byDay = grouped.get(key) ?? new Map<string, number>();
    byDay.set(row.day, (byDay.get(row.day) ?? 0) + row.total);
    grouped.set(key, byDay);
  }
  return [...grouped.entries()]
    .sort(([, left], [, right]) => {
      const leftTotal = [...left.values()].reduce(
        (sum, value) => sum + value,
        0,
      );
      const rightTotal = [...right.values()].reduce(
        (sum, value) => sum + value,
        0,
      );
      return rightTotal - leftTotal;
    })
    .map(([key, byDay]) => ({
      key: `${group}:${key}`,
      label: group === "protocol" ? (protocolLabels[key] ?? key) : key,
      values: days.map((day) =>
        firstDay && day < firstDay ? null : (byDay.get(day) ?? 0),
      ),
    }));
}

function coverageLabel() {
  return page.copy.experience.coverage
    .replace("{from}", page.coverage.fromDay)
    .replace("{to}", page.coverage.endDayExclusive);
}

function firstRecordedLabel() {
  if (!page.coverage.firstRecordedAt) return page.copy.experience.noRecordedAt;
  return page.copy.experience.firstRecordedAt.replace(
    "{at}",
    dateFormatter.format(new Date(page.coverage.firstRecordedAt)),
  );
}

function outcomeVariant(outcome: string) {
  return outcome === "success"
    ? "secondary"
    : outcome === "unknown"
      ? "outline"
      : "destructive";
}
</script>

<section aria-labelledby="experience-window-title" class="grid gap-4 border-y py-4">
  <div class="flex flex-wrap items-baseline justify-between gap-3">
    <div class="grid gap-1">
      <h2 id="experience-window-title" class="text-base font-semibold">{page.copy.experience.window}</h2>
      <p class="text-sm text-muted-foreground">{coverageLabel()}</p>
      <p class="text-xs text-muted-foreground">{firstRecordedLabel()}</p>
    </div>
  </div>

  <form method="GET">
    <input type="hidden" name="days" value={page.days} />
    <Field.Group class="gap-4">
      <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Field.Field>
          <Field.Label for="experience-feature">{page.copy.experience.feature}</Field.Label>
          <NativeSelect.Root class="w-full" id="experience-feature" name="feature">
            <NativeSelect.Option value="">{page.copy.experience.all}</NativeSelect.Option>
            {#each page.catalog.features as feature}
              <NativeSelect.Option value={feature} selected={page.filters.feature === feature}>{label("features", feature)}</NativeSelect.Option>
            {/each}
          </NativeSelect.Root>
        </Field.Field>
        <Field.Field>
          <Field.Label for="experience-operation">{page.copy.experience.operation}</Field.Label>
          <Input id="experience-operation" name="operation" value={page.filters.operation ?? ""} placeholder={page.copy.experience.operationPlaceholder} />
        </Field.Field>
        <Field.Field>
          <Field.Label for="experience-protocol">{page.copy.experience.protocol}</Field.Label>
          <NativeSelect.Root class="w-full" id="experience-protocol" name="protocol">
            <NativeSelect.Option value="">{page.copy.experience.all}</NativeSelect.Option>
            {#each page.catalog.protocols as protocol}
              <NativeSelect.Option value={protocol} selected={page.filters.protocol === protocol}>{label("protocols", protocol)}</NativeSelect.Option>
            {/each}
          </NativeSelect.Root>
        </Field.Field>
        <Field.Field>
          <Field.Label for="experience-surface">{page.copy.experience.surface}</Field.Label>
          <NativeSelect.Root class="w-full" id="experience-surface" name="surface">
            <NativeSelect.Option value="">{page.copy.experience.all}</NativeSelect.Option>
            {#each page.catalog.surfaces as surface}
              <NativeSelect.Option value={surface} selected={page.filters.surface === surface}>{label("surfaces", surface)}</NativeSelect.Option>
            {/each}
          </NativeSelect.Root>
        </Field.Field>
        <Field.Field>
          <Field.Label for="experience-auth">{page.copy.experience.authMode}</Field.Label>
          <NativeSelect.Root class="w-full" id="experience-auth" name="authMode">
            <NativeSelect.Option value="">{page.copy.experience.all}</NativeSelect.Option>
            {#each page.catalog.authModes as authMode}
              <NativeSelect.Option value={authMode} selected={page.filters.authMode === authMode}>{label("authModes", authMode)}</NativeSelect.Option>
            {/each}
          </NativeSelect.Root>
        </Field.Field>
        <Field.Field>
          <Field.Label for="experience-outcome">{page.copy.experience.outcome}</Field.Label>
          <NativeSelect.Root class="w-full" id="experience-outcome" name="outcome">
            <NativeSelect.Option value="">{page.copy.experience.all}</NativeSelect.Option>
            {#each page.catalog.outcomes as outcome}
              <NativeSelect.Option value={outcome} selected={page.filters.outcome === outcome}>{label("outcomes", outcome)}</NativeSelect.Option>
            {/each}
          </NativeSelect.Root>
        </Field.Field>
      </div>
      <Field.Field orientation="horizontal" class="gap-2">
        <Button class="flex-1 sm:flex-none" type="submit">{page.copy.experience.apply}</Button>
        <Button class="flex-1 sm:flex-none" href="/admin/analytics" variant="outline">{page.copy.experience.clear}</Button>
      </Field.Field>
    </Field.Group>
  </form>
</section>

{#if page.status.state === "unavailable"}
  <Alert.Root variant="destructive">
    <Alert.Title>{page.copy.experience.unavailable}</Alert.Title>
    <Alert.Description>{page.copy.experience.unavailableQuery}</Alert.Description>
  </Alert.Root>
{:else if page.status.state === "empty"}
  <Empty.Root class="items-start border-y px-0 text-left">
    <Empty.Header class="items-start text-left">
      <Empty.Title>{page.copy.experience.notObserved}</Empty.Title>
      <Empty.Description>{page.copy.experience.notObservedDescription}</Empty.Description>
    </Empty.Header>
  </Empty.Root>
{:else}
  <section aria-labelledby="experience-summary-title" class="grid gap-3">
    <div class="flex flex-wrap items-end justify-between gap-2">
      <div class="grid gap-1">
        <h2 id="experience-summary-title" class="text-lg font-semibold">{page.copy.experience.summary}</h2>
        <p class="text-sm text-muted-foreground">{page.copy.experience.summaryDescription}</p>
      </div>
    </div>
    <dl class="grid grid-cols-2 gap-x-6 gap-y-5 border-y py-4 sm:grid-cols-3 xl:grid-cols-5">
      <div class="grid content-start gap-1"><dt class="text-sm text-muted-foreground">{page.copy.experience.total}</dt><dd class="text-2xl font-semibold tabular-nums">{numberFormatter.format(page.summary.total)}</dd></div>
      <div class="grid content-start gap-1"><dt class="text-sm text-muted-foreground">{page.copy.experience.rejected}</dt><dd class="text-2xl font-semibold tabular-nums">{numberFormatter.format(page.summary.rejected)}</dd></div>
      <div class="grid content-start gap-1"><dt class="text-sm text-muted-foreground">{page.copy.experience.errors}</dt><dd class="text-2xl font-semibold tabular-nums">{numberFormatter.format(page.summary.errors)}</dd></div>
      <div class="grid content-start gap-1"><dt class="text-sm text-muted-foreground">{page.copy.experience.unknown}</dt><dd class="text-2xl font-semibold tabular-nums">{numberFormatter.format(page.summary.unknown)}</dd></div>
      <div class="grid content-start gap-1"><dt class="text-sm text-muted-foreground">{page.copy.experience.identifiedUsers}</dt><dd class="text-2xl font-semibold tabular-nums">{numberFormatter.format(page.summary.activeUsers)}</dd><dd class="text-xs text-muted-foreground">{page.copy.experience.identifiedUsersDescription}</dd></div>
    </dl>
  </section>

  <section aria-labelledby="experience-trends-title" class="grid min-w-0 gap-5">
    <header class="grid gap-1">
      <h2 id="experience-trends-title" class="text-lg font-semibold">{page.copy.experience.trends}</h2>
      <p class="text-sm text-muted-foreground">{page.copy.experience.trendsDescription}</p>
    </header>
    <div class="grid min-w-0 gap-6 lg:grid-cols-2">
      <DailySeriesChart
        id="telemetry-operations"
        days={chartDays}
        series={operationSeries}
        partialDays={partialDays}
        title={page.copy.experience.operationTrend}
        description={page.copy.experience.operationTrendDescription}
        locale={page.locale}
        labels={{ legend: page.copy.experience.chartLegend, inspect: page.copy.experience.chartInspect, dataTable: page.copy.experience.chartDataTable, noData: page.copy.experience.chartNoData, value: page.copy.experience.chartValue, day: page.copy.experience.chartDay, partial: page.copy.experience.chartPartial }}
      />
      <DailySeriesChart
        id="telemetry-protocols"
        days={chartDays}
        series={protocolSeries}
        partialDays={partialDays}
        title={page.copy.experience.protocolTrend}
        description={page.copy.experience.protocolTrendDescription}
        locale={page.locale}
        labels={{ legend: page.copy.experience.chartLegend, inspect: page.copy.experience.chartInspect, dataTable: page.copy.experience.chartDataTable, noData: page.copy.experience.chartNoData, value: page.copy.experience.chartValue, day: page.copy.experience.chartDay, partial: page.copy.experience.chartPartial }}
      />
    </div>
  </section>

  <details class="grid min-w-0 gap-3 rounded-lg border p-4">
    <summary class="cursor-pointer font-semibold">{page.copy.experience.matrix}</summary>
    <div class="grid gap-3 pt-2">
      <p class="text-sm text-muted-foreground">{page.copy.experience.matrixDescription}</p>
      {#if page.rowsTruncated}<p class="text-sm text-muted-foreground">{page.copy.experience.matrixPartial}</p>{/if}

      <AdminListShell class="xl:hidden py-1">
        <Item.Group class="gap-0">
          {#each page.rows as row, index (`${row.feature}-${row.operation}-${row.protocol}-${row.surface}-${row.authMode}-${row.outcome}`)}
            <Item.Root variant="default" class="grid gap-3 px-1 py-3">
              <Item.Content class="min-w-0">
                <Item.Title class="break-words">{row.feature} · {row.operation}</Item.Title>
                <Item.Description>{label("protocols", row.protocol)} · {label("surfaces", row.surface)} · {label("authModes", row.authMode)}</Item.Description>
              </Item.Content>
              <Item.Actions class="flex-wrap">
                <Badge variant={outcomeVariant(row.outcome)}>{label("outcomes", row.outcome)}</Badge>
                <span class="tabular-nums">{numberFormatter.format(row.total)}</span>
              </Item.Actions>
              <Item.Footer>
                <dl class="grid w-full grid-cols-2 gap-2 text-xs">
                  <div><dt class="text-muted-foreground">{page.copy.experience.rejected}</dt><dd class="tabular-nums">{numberFormatter.format(row.rejectedCount)}</dd></div>
                  <div><dt class="text-muted-foreground">{page.copy.experience.errors}</dt><dd class="tabular-nums">{numberFormatter.format(row.errorCount)}</dd></div>
                  <div><dt class="text-muted-foreground">{page.copy.experience.p50}</dt><dd class="tabular-nums">{metricWithUnit(row.p50WallMs)}</dd></div>
                  <div><dt class="text-muted-foreground">{page.copy.experience.p95}</dt><dd class="tabular-nums">{metricWithUnit(row.p95WallMs)}</dd></div>
                </dl>
              </Item.Footer>
            </Item.Root>
            {#if index < page.rows.length - 1}<Item.Separator class="my-0" />{/if}
          {/each}
        </Item.Group>
      </AdminListShell>

      <AdminTableShell class="hidden xl:block" label={page.copy.experience.matrix}>
        <Table.Root class="min-w-[75rem]">
          <Table.Caption class="sr-only">{page.copy.experience.matrix}</Table.Caption>
          <Table.Header>
            <Table.Row>
              <Table.Head>{page.copy.experience.feature}</Table.Head>
              <Table.Head>{page.copy.experience.operation}</Table.Head>
              <Table.Head>{page.copy.experience.protocol}</Table.Head>
              <Table.Head>{page.copy.experience.surface}</Table.Head>
              <Table.Head>{page.copy.experience.authMode}</Table.Head>
              <Table.Head>{page.copy.experience.outcome}</Table.Head>
              <Table.Head class="text-right">{page.copy.experience.total}</Table.Head>
              <Table.Head class="text-right">{page.copy.experience.rejected}</Table.Head>
              <Table.Head class="text-right">{page.copy.experience.errors}</Table.Head>
              <Table.Head class="text-right">{page.copy.experience.p50}</Table.Head>
              <Table.Head class="text-right">{page.copy.experience.p95}</Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {#each page.rows as row (`${row.feature}-${row.operation}-${row.protocol}-${row.surface}-${row.authMode}-${row.outcome}`)}
              <Table.Row class="align-top">
                <Table.Cell class="whitespace-nowrap">{row.feature}</Table.Cell>
                <Table.Cell class="max-w-0"><span class="block max-w-52 truncate" title={row.operation}>{row.operation}</span></Table.Cell>
                <Table.Cell>{label("protocols", row.protocol)}</Table.Cell>
                <Table.Cell>{label("surfaces", row.surface)}</Table.Cell>
                <Table.Cell>{label("authModes", row.authMode)}</Table.Cell>
                <Table.Cell><Badge variant={outcomeVariant(row.outcome)}>{label("outcomes", row.outcome)}</Badge></Table.Cell>
                <Table.Cell class="text-right tabular-nums">{numberFormatter.format(row.total)}</Table.Cell>
                <Table.Cell class="text-right tabular-nums">{numberFormatter.format(row.rejectedCount)}</Table.Cell>
                <Table.Cell class="text-right tabular-nums">{numberFormatter.format(row.errorCount)}</Table.Cell>
                <Table.Cell class="text-right tabular-nums">{metricWithUnit(row.p50WallMs)}</Table.Cell>
                <Table.Cell class="text-right tabular-nums">{metricWithUnit(row.p95WallMs)}</Table.Cell>
              </Table.Row>
            {/each}
          </Table.Body>
        </Table.Root>
      </AdminTableShell>
    </div>
  </details>
{/if}

<section class="grid gap-3 border-t pt-4" aria-labelledby="experience-notes-title">
  <h2 id="experience-notes-title" class="text-lg font-semibold">{page.copy.experience.notes}</h2>
  <ul class="grid gap-2 text-sm text-muted-foreground">
    <li>{page.copy.experience.recordedCountsNote}</li>
    <li>{page.copy.experience.backgroundDeliveryNote}</li>
    <li>{page.copy.experience.noHistoricalBackfillNote}</li>
    <li>{page.copy.experience.currentDayPartialNote}</li>
    <li>{page.copy.experience.retentionNote}</li>
    <li>{page.copy.experience.identityNote}</li>
  </ul>
</section>
