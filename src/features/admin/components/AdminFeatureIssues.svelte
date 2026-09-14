<script lang="ts">
import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
import { goto } from "$app/navigation";
import DailySeriesChart from "$lib/components/charts/DailySeriesChart.svelte";
import DashboardPanel from "$lib/components/dashboard/DashboardPanel.svelte";
import StatPanels from "$lib/components/dashboard/StatPanels.svelte";
import * as Alert from "$lib/components/ui/alert/index.js";
import { Badge } from "$lib/components/ui/badge/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import * as Collapsible from "$lib/components/ui/collapsible/index.js";
import * as Empty from "$lib/components/ui/empty/index.js";
import * as Field from "$lib/components/ui/field/index.js";
import { Input } from "$lib/components/ui/input/index.js";
import * as NativeSelect from "$lib/components/ui/native-select/index.js";
import * as ToggleGroup from "$lib/components/ui/toggle-group/index.js";
import type messages from "../../../../messages/en-us.json";
import type { readAdminFeatureIssues } from "../server/admin-experience-page-data";

type BackendIssues = Awaited<ReturnType<typeof readAdminFeatureIssues>>;
type IssueView = "issues" | "all";
type PanelSection = "operations" | "runtime";
type PageData = BackendIssues;
type IssueQueryChanges = {
  actor?: string | null;
  cursor?: string | null;
  days?: number | null;
  feature?: string | null;
  operation?: string | null;
  outcome?: string | null;
  protocol?: string | null;
  view?: IssueView;
};

export let data: PageData;
export let copy: typeof messages.adminExperience;
export let locale: string;
export let auditFilters: Record<string, string | undefined>;
export let section: PanelSection = "operations";
export let adminTab: PanelSection = "operations";
export let advancedFiltersLabel: string | undefined;

let filtersOpen = false;

$: page = data;
$: dateFormatter = new Intl.DateTimeFormat(locale, {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Shanghai",
});
$: numberFormatter = new Intl.NumberFormat(locale);
$: durationFormatter = new Intl.NumberFormat(locale, {
  maximumFractionDigits: 1,
});
$: activeView = page.view;
$: issueFilters = page.filters;
$: hasAdvancedFilters = Boolean(
  issueFilters.operation || issueFilters.outcome || issueFilters.actor,
);
$: if (hasAdvancedFilters) filtersOpen = true;
$: issueChartDays = buildChartDays(
  page.coverage.fromDay,
  page.coverage.endDayExclusive,
  page.daily,
);
$: issuePartialDays = issueChartDays.map(
  (day) => page.coverage.endDayExclusive === nextShanghaiDay(day),
);
$: issueChartSeries = buildChartSeries(
  issueChartDays,
  page.daily,
  page.coverage.firstRecordedAt,
  {
    errors: copy.errors,
    rejected: copy.rejected,
    total: copy.total,
    unknown: copy.unknown,
  },
);
$: issueStats = [
  { label: copy.total, value: numberFormatter.format(page.summary.total) },
  { label: copy.errors, value: numberFormatter.format(page.summary.errors) },
  {
    label: copy.rejected,
    value: numberFormatter.format(page.summary.rejected),
  },
  { label: copy.unknown, value: numberFormatter.format(page.summary.unknown) },
];

function label(group: string, value: string) {
  const labels = (copy as Record<string, unknown>)[group] as
    | Record<string, string>
    | undefined;
  return labels?.[value] ?? value;
}

function outcomeVariant(outcome: string) {
  return outcome === "success"
    ? "secondary"
    : outcome === "unknown"
      ? "outline"
      : "destructive";
}

function formatDate(value: string) {
  return dateFormatter.format(new Date(value));
}

function formatDuration(value: number) {
  return `${durationFormatter.format(value)} ms`;
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

function buildChartSeries(
  days: readonly string[],
  rows: PageData["daily"],
  firstRecordedAt: string | null,
  labels: { errors: string; rejected: string; total: string; unknown: string },
) {
  const firstDay = recordedDay(firstRecordedAt);
  const byDay = new Map(rows.map((row) => [row.day, row]));
  return [
    {
      key: "total",
      label: labels.total,
      value: (row: PageData["daily"][number]) => row.total,
    },
    {
      key: "errors",
      label: labels.errors,
      value: (row: PageData["daily"][number]) => row.errorCount,
    },
    {
      key: "rejected",
      label: labels.rejected,
      value: (row: PageData["daily"][number]) => row.rejectedCount,
    },
    {
      key: "unknown",
      label: labels.unknown,
      value: (row: PageData["daily"][number]) => row.unknownCount,
    },
  ].map(({ key, label, value }) => ({
    key,
    label,
    values: days.map((day) => {
      if (!firstDay || day < firstDay) return null;
      const row = byDay.get(day);
      return row ? value(row) : 0;
    }),
  }));
}

function issueHref(view = activeView, changes: IssueQueryChanges = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(auditFilters)) {
    if (value) params.set(key, value);
  }

  const filters = page.filters;
  const values = {
    actor: filters.actor,
    days: page.days,
    feature: filters.feature,
    operation: filters.operation,
    outcome: filters.outcome,
    protocol: filters.protocol,
  };
  for (const key of Object.keys(values) as Array<keyof typeof values>) {
    if (key in changes) {
      const value = changes[key];
      if (value === null || value === undefined) delete values[key];
      else values[key] = value as never;
    }
  }
  params.set("admin_tab", adminTab);
  params.set("issue_view", changes.view ?? view);
  if (values.days) params.set("issue_days", String(values.days));
  if (values.feature) params.set("issue_feature", values.feature);
  if (values.operation) params.set("issue_operation", values.operation);
  if (values.protocol) params.set("issue_protocol", values.protocol);
  if (values.outcome) params.set("issue_outcome", values.outcome);
  if (values.actor) params.set("issue_actor", values.actor);
  if (changes.cursor) params.set("issue_cursor", changes.cursor);

  const query = params.toString();
  return query ? `/admin/audit?${query}` : "/admin/audit";
}

function groupHref(group: PageData["groups"][number]) {
  return issueHref(activeView, {
    feature: group.feature,
    operation: group.operation,
    outcome: group.outcome,
    protocol: group.protocol,
  });
}

function selectView(value: string) {
  if (value === "issues" || value === "all") {
    void goto(issueHref(value), { keepFocus: true });
  }
}
</script>

{#if section === "runtime"}
  <section aria-labelledby="runtime-issues-title" class="grid min-w-0 gap-4 [&>*]:min-w-0">
    <DashboardPanel
      id="runtime-issues"
      title={copy.runtimeIssues}
      description={copy.runtimeIssuesDescription}
    >
      {#if page.errorsStatus.state === "unavailable"}
        <Alert.Root variant="destructive">
          <Alert.Title>{copy.unavailable}</Alert.Title>
          <Alert.Description>{copy.unavailableQuery}</Alert.Description>
        </Alert.Root>
      {:else if page.runtimeIssues.length === 0}
        <Empty.Root class="items-start px-0 text-left">
          <Empty.Header class="items-start text-left">
            <Empty.Title>{copy.noRuntimeIssues}</Empty.Title>
          </Empty.Header>
        </Empty.Root>
      {:else}
        <ul class="divide-y rounded-md border" aria-label={copy.runtimeIssues}>
          {#each page.runtimeIssues as issue (issue.id)}
            <li class="grid gap-2 px-3 py-3 text-sm sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] sm:items-start">
              <div class="flex min-w-0 flex-wrap items-center gap-2">
                <Badge variant={issue.level === "error" ? "destructive" : "outline"}>{issue.level}</Badge>
                <span class="font-medium">{issue.event}</span>
                <span class="text-xs text-muted-foreground">{formatDate(issue.occurredAt)}</span>
              </div>
              <dl class="grid gap-x-4 gap-y-1 text-xs text-muted-foreground sm:grid-cols-3">
                <div class="min-w-0"><dt class="inline">{copy.route}: </dt><dd class="inline break-all">{issue.route ?? "—"}</dd></div>
                <div><dt class="inline">{copy.status}: </dt><dd class="inline">{issue.status ?? "—"}</dd></div>
                <div class="min-w-0"><dt class="inline">{copy.requestId}: </dt><dd class="inline break-all font-mono">{issue.requestId ?? copy.noRequestId}</dd></div>
              </dl>
            </li>
          {/each}
        </ul>
      {/if}
    </DashboardPanel>
  </section>
{:else}
  <section aria-labelledby="experience-errors-title" class="grid min-w-0 gap-4 [&>*]:min-w-0">
    <DashboardPanel
      id="experience-errors"
      title={copy.recentErrors}
      description={copy.recentErrorsDescription}
    >
      <div class="flex flex-wrap items-center justify-between gap-3">
        <ToggleGroup.Root
          aria-label={copy.issueView}
          type="single"
          value={activeView}
          variant="outline"
          onValueChange={selectView}
        >
          <ToggleGroup.Item value="issues">{copy.issuesOnly}</ToggleGroup.Item>
          <ToggleGroup.Item value="all">{copy.allEvents}</ToggleGroup.Item>
        </ToggleGroup.Root>

      </div>

      <form method="GET" aria-label={copy.recentErrors}>
        {#each Object.entries(auditFilters) as [key, value]}
          {#if value}<input type="hidden" name={key} value={value} />{/if}
        {/each}
        <input type="hidden" name="admin_tab" value={adminTab} />
        <input type="hidden" name="issue_view" value={activeView} />
        <Field.Group class="gap-3">
          <div class="grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-3 [&>*]:min-w-0">
            <Field.Field class="col-span-2 sm:col-span-1">
              <Field.Label for="issue-days">{copy.window}</Field.Label>
              <NativeSelect.Root class="w-full min-w-0" id="issue-days" name="issue_days">
                {#each [7, 30, 90] as days}
                  <NativeSelect.Option value={String(days)} selected={page.days === days}>{copy.issueDays.replace("{days}", String(days))}</NativeSelect.Option>
                {/each}
              </NativeSelect.Root>
            </Field.Field>
            <Field.Field>
              <Field.Label for="issue-feature">{copy.feature}</Field.Label>
              <NativeSelect.Root class="w-full min-w-0" id="issue-feature" name="issue_feature">
                <NativeSelect.Option value="">{copy.all}</NativeSelect.Option>
                {#each page.catalog.features as feature}
                  <NativeSelect.Option value={feature} selected={page.filters.feature === feature}>{label("features", feature)}</NativeSelect.Option>
                {/each}
              </NativeSelect.Root>
            </Field.Field>
            <Field.Field>
              <Field.Label for="issue-protocol">{copy.protocol}</Field.Label>
              <NativeSelect.Root class="w-full min-w-0" id="issue-protocol" name="issue_protocol">
                <NativeSelect.Option value="">{copy.all}</NativeSelect.Option>
                {#each page.catalog.protocols as protocol}
                  <NativeSelect.Option value={protocol} selected={page.filters.protocol === protocol}>{label("protocols", protocol)}</NativeSelect.Option>
                {/each}
              </NativeSelect.Root>
            </Field.Field>
          </div>

          <Collapsible.Root bind:open={filtersOpen} class="rounded-md border bg-muted/20">
            <Collapsible.Trigger class="group flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm font-medium hover:bg-muted/40">
              <span>{advancedFiltersLabel ?? copy.moreIssues}</span>
              <ChevronRightIcon aria-hidden="true" class="shrink-0 transition-transform group-data-[state=open]:rotate-90" />
            </Collapsible.Trigger>
            <Collapsible.Content class="border-t p-3 data-[state=closed]:hidden">
              <div class="grid min-w-0 gap-3 sm:grid-cols-3 [&>*]:min-w-0">
                <Field.Field>
                  <Field.Label for="issue-operation">{copy.operation}</Field.Label>
                  <NativeSelect.Root class="w-full min-w-0" id="issue-operation" name="issue_operation">
                    <NativeSelect.Option value="">{copy.all}</NativeSelect.Option>
                    {#each page.catalog.operations as operation}
                      <NativeSelect.Option value={operation} selected={issueFilters.operation === operation}>{label("operations", operation)}</NativeSelect.Option>
                    {/each}
                  </NativeSelect.Root>
                </Field.Field>
                <Field.Field>
                  <Field.Label for="issue-outcome">{copy.outcome}</Field.Label>
                  <NativeSelect.Root class="w-full min-w-0" id="issue-outcome" name="issue_outcome">
                    <NativeSelect.Option value="">{copy.all}</NativeSelect.Option>
                    {#each page.catalog.outcomes as outcome}
                      <NativeSelect.Option value={outcome} selected={issueFilters.outcome === outcome}>{label("outcomes", outcome)}</NativeSelect.Option>
                    {/each}
                  </NativeSelect.Root>
                </Field.Field>
                <Field.Field>
                  <Field.Label for="issue-actor">{copy.actor}</Field.Label>
                  <Input id="issue-actor" name="issue_actor" value={issueFilters.actor ?? ""} placeholder={copy.actorPlaceholder} />
                </Field.Field>
              </div>
            </Collapsible.Content>
          </Collapsible.Root>

          <Field.Field orientation="horizontal" class="gap-2">
            <Button type="submit">{copy.issueApply}</Button>
            <Button href={issueHref(activeView, { actor: null, feature: null, operation: null, outcome: null, protocol: null })} variant="outline">{copy.clear}</Button>
          </Field.Field>
        </Field.Group>
      </form>
    </DashboardPanel>

    {#if page.errorsStatus.state === "unavailable"}
      <Alert.Root variant="destructive">
        <Alert.Title>{copy.unavailable}</Alert.Title>
        <Alert.Description>{copy.unavailableQuery}</Alert.Description>
      </Alert.Root>
    {:else}
      <StatPanels items={issueStats} />

      <div class="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)]">
        <DailySeriesChart
          id="issues-daily"
          days={issueChartDays}
          series={issueChartSeries}
          partialDays={issuePartialDays}
          title={copy.issueTrend}
          description={copy.issueTrendDescription}
          locale={locale}
          labels={{ legend: copy.chartLegend, inspect: copy.chartInspect, dataTable: copy.chartDataTable, noData: copy.chartNoData, value: copy.chartValue, day: copy.chartDay, partial: copy.chartPartial }}
        />

        <DashboardPanel
          id="issue-priority"
          title={copy.priorityOverview}
          description={copy.priorityOverviewDescription}
        >
          {#if page.groups.length === 0}
            <Empty.Root class="items-start px-0 text-left">
              <Empty.Header class="items-start text-left">
                <Empty.Title>{copy.noRecentErrors}</Empty.Title>
                <Empty.Description>{copy.noIssueGroups}</Empty.Description>
              </Empty.Header>
            </Empty.Root>
          {:else}
            <div class="grid max-h-64 divide-y overflow-y-auto rounded-md border">
              {#each page.groups as group}
                <a class="group grid min-w-0 gap-2 px-3 py-3 transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none" href={groupHref(group)}>
                  <div class="flex min-w-0 items-start justify-between gap-3">
                    <div class="grid min-w-0 gap-1">
                      <h3 class="break-words text-sm font-semibold">{label("features", group.feature)} · {label("operations", group.operation)}</h3>
                      <p class="break-words text-xs text-muted-foreground">{label("protocols", group.protocol)} · {label("errorClasses", group.errorClass)}</p>
                    </div>
                    <ChevronRightIcon aria-hidden="true" class="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </div>
                  <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <Badge variant={outcomeVariant(group.outcome)}>{label("outcomes", group.outcome)}</Badge>
                    <span>{copy.issueCount}: <strong class="font-medium text-foreground tabular-nums">{numberFormatter.format(group.count)}</strong></span>
                    <span>{copy.lastSeen}: {formatDate(group.lastSeen)}</span>
                  </div>
                </a>
              {/each}
            </div>
          {/if}
        </DashboardPanel>
      </div>

      <DashboardPanel
        id="issue-timeline"
        title={copy.eventTimeline}
        description={copy.eventTimelineDescription}
        class="min-w-0"
      >
        {#if page.errorsTruncated && page.nextCursor}
          <p class="text-xs text-muted-foreground">{copy.moreIssues}</p>
        {/if}
        {#if page.errorSamples.length === 0}
          <Empty.Root class="items-start px-0 text-left">
            <Empty.Header class="items-start text-left">
              <Empty.Title>{copy.noRecentErrors}</Empty.Title>
              <Empty.Description>{copy.noRecentErrorsDescription}</Empty.Description>
            </Empty.Header>
          </Empty.Root>
        {:else}
          <ol class="max-h-[36rem] divide-y overflow-y-auto rounded-md border" aria-label={copy.eventTimeline}>
            {#each page.errorSamples as sample (sample.id)}
              <li>
                <details name="feature-operation-event">
                  <summary class="flex cursor-pointer flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm">
                    <span class="grid min-w-0 gap-0.5">
                      <span class="truncate font-medium">{label("features", sample.feature)} · {label("operations", sample.operation)}</span>
                      <span class="text-xs text-muted-foreground">{formatDate(sample.occurredAt)} · {label("protocols", sample.protocol)}</span>
                    </span>
                    <Badge variant={outcomeVariant(sample.outcome)}>{label("outcomes", sample.outcome)}</Badge>
                  </summary>
                  <dl class="grid gap-x-4 gap-y-2 border-t bg-muted/20 px-3 py-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
                    <div><dt class="text-muted-foreground">{copy.errorClass}</dt><dd>{label("errorClasses", sample.errorClass)}</dd></div>
                    <div><dt class="text-muted-foreground">{copy.duration}</dt><dd class="tabular-nums">{formatDuration(sample.durationMs)}</dd></div>
                    <div><dt class="text-muted-foreground">{copy.userId}</dt><dd class="break-all font-mono">{sample.userId ?? copy.noUser}</dd></div>
                    <div><dt class="text-muted-foreground">{copy.requestId}</dt><dd class="break-all font-mono">{sample.requestId ?? copy.noRequestId}</dd></div>
                    <div><dt class="text-muted-foreground">{copy.authMode}</dt><dd>{label("authModes", sample.authMode)}</dd></div>
                    <div><dt class="text-muted-foreground">{copy.surface}</dt><dd>{label("surfaces", sample.surface)}</dd></div>
                    <div class="sm:col-span-2 lg:col-span-4"><dt class="text-muted-foreground">{copy.eventId}</dt><dd class="break-all font-mono">{sample.id}</dd></div>
                  </dl>
                </details>
              </li>
            {/each}
          </ol>
        {/if}
        {#if page.errorsTruncated && page.nextCursor}
          <div class="flex justify-end">
            <Button href={issueHref(activeView, { cursor: page.nextCursor })} variant="outline">{copy.nextPage}</Button>
          </div>
        {/if}
      </DashboardPanel>
    {/if}
  </section>
{/if}
