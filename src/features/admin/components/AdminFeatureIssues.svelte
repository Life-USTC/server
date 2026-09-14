<script lang="ts">
import DailySeriesChart from "$lib/components/charts/DailySeriesChart.svelte";
import * as Alert from "$lib/components/ui/alert/index.js";
import { Badge } from "$lib/components/ui/badge/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import * as Empty from "$lib/components/ui/empty/index.js";
import * as Field from "$lib/components/ui/field/index.js";
import { Input } from "$lib/components/ui/input/index.js";
import * as NativeSelect from "$lib/components/ui/native-select/index.js";
import type messages from "../../../../messages/en-us.json";
import type { readAdminFeatureIssues } from "../server/admin-experience-page-data";

type BackendIssues = Awaited<ReturnType<typeof readAdminFeatureIssues>>;
type IssueView = "issues" | "all";
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
      if (firstDay && day < firstDay) return null;
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
</script>

<section aria-labelledby="experience-errors-title" class="grid gap-4 border-t pt-4">
  <div class="grid gap-1">
    <h2 id="experience-errors-title" class="text-lg font-semibold">{copy.recentErrors}</h2>
    <p class="text-sm text-muted-foreground">{copy.recentErrorsDescription}</p>
  </div>

  <nav class="flex flex-wrap gap-2" aria-label={copy.issueView}>
    <Button href={issueHref("issues")} variant={activeView === "issues" ? "default" : "outline"} aria-current={activeView === "issues" ? "page" : undefined}>{copy.issuesOnly}</Button>
    <Button href={issueHref("all")} variant={activeView === "all" ? "default" : "outline"} aria-current={activeView === "all" ? "page" : undefined}>{copy.allEvents}</Button>
  </nav>

  <form method="GET" aria-label={copy.recentErrors}>
    {#each Object.entries(auditFilters) as [key, value]}{#if value}<input type="hidden" name={key} value={value} />{/if}{/each}
    <input type="hidden" name="issue_view" value={activeView} />
    <Field.Group class="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <Field.Field>
        <Field.Label for="issue-days">{copy.window}</Field.Label>
        <NativeSelect.Root id="issue-days" name="issue_days">
          {#each [7, 30, 90] as days}
            <NativeSelect.Option value={String(days)} selected={page.days === days}>{copy.issueDays.replace("{days}", String(days))}</NativeSelect.Option>
          {/each}
        </NativeSelect.Root>
      </Field.Field>
      <Field.Field>
        <Field.Label for="issue-feature">{copy.feature}</Field.Label>
        <NativeSelect.Root id="issue-feature" name="issue_feature">
          <NativeSelect.Option value="">{copy.all}</NativeSelect.Option>
          {#each page.catalog.features as feature}
            <NativeSelect.Option value={feature} selected={page.filters.feature === feature}>{label("features", feature)}</NativeSelect.Option>
          {/each}
        </NativeSelect.Root>
      </Field.Field>
      <Field.Field>
        <Field.Label for="issue-protocol">{copy.protocol}</Field.Label>
        <NativeSelect.Root id="issue-protocol" name="issue_protocol">
          <NativeSelect.Option value="">{copy.all}</NativeSelect.Option>
          {#each page.catalog.protocols as protocol}
            <NativeSelect.Option value={protocol} selected={page.filters.protocol === protocol}>{label("protocols", protocol)}</NativeSelect.Option>
          {/each}
        </NativeSelect.Root>
      </Field.Field>
      <Field.Field>
        <Field.Label for="issue-operation">{copy.operation}</Field.Label>
        <Input id="issue-operation" name="issue_operation" value={issueFilters.operation ?? ""} placeholder={copy.operationPlaceholder} />
      </Field.Field>
      <Field.Field>
        <Field.Label for="issue-outcome">{copy.outcome}</Field.Label>
        <NativeSelect.Root id="issue-outcome" name="issue_outcome">
          <NativeSelect.Option value="">{copy.all}</NativeSelect.Option>
          {#each page.catalog.outcomes as outcome}
            <NativeSelect.Option value={outcome} selected={page.filters.outcome === outcome}>{label("outcomes", outcome)}</NativeSelect.Option>
          {/each}
        </NativeSelect.Root>
      </Field.Field>
      <Field.Field>
        <Field.Label for="issue-actor">{copy.actor}</Field.Label>
        <Input id="issue-actor" name="issue_actor" value={issueFilters.actor ?? ""} placeholder={copy.actorPlaceholder} />
      </Field.Field>
      <Field.Field orientation="horizontal" class="gap-2 sm:col-span-2 xl:col-span-5">
        <Button type="submit">{copy.issueApply}</Button>
        <Button href={issueHref(activeView, { actor: null, feature: null, operation: null, outcome: null, protocol: null })} variant="outline">{copy.clear}</Button>
      </Field.Field>
    </Field.Group>
  </form>

  {#if page.errorsStatus.state === "unavailable"}
    <Alert.Root variant="destructive">
      <Alert.Title>{copy.unavailable}</Alert.Title>
      <Alert.Description>{copy.unavailableQuery}</Alert.Description>
    </Alert.Root>
  {:else}
    <section aria-labelledby="issue-summary-title" class="grid gap-3">
      <div class="grid gap-1">
        <h3 id="issue-summary-title" class="text-base font-semibold">{copy.issueSummary}</h3>
        <p class="text-sm text-muted-foreground">{copy.issueSummaryDescription}</p>
      </div>
      <dl class="grid grid-cols-2 gap-x-6 gap-y-4 border-y py-4 sm:grid-cols-4">
        <div class="grid gap-1"><dt class="text-sm text-muted-foreground">{copy.total}</dt><dd class="text-xl font-semibold tabular-nums">{numberFormatter.format(page.summary.total)}</dd></div>
        <div class="grid gap-1"><dt class="text-sm text-muted-foreground">{copy.errors}</dt><dd class="text-xl font-semibold tabular-nums">{numberFormatter.format(page.summary.errors)}</dd></div>
        <div class="grid gap-1"><dt class="text-sm text-muted-foreground">{copy.rejected}</dt><dd class="text-xl font-semibold tabular-nums">{numberFormatter.format(page.summary.rejected)}</dd></div>
        <div class="grid gap-1"><dt class="text-sm text-muted-foreground">{copy.unknown}</dt><dd class="text-xl font-semibold tabular-nums">{numberFormatter.format(page.summary.unknown)}</dd></div>
      </dl>
    </section>

    {#if page.daily.length > 0}
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
    {/if}

    <section aria-labelledby="issue-priority-title" class="grid gap-3">
      <div class="grid gap-1">
        <h3 id="issue-priority-title" class="text-base font-semibold">{copy.priorityOverview}</h3>
        <p class="text-sm text-muted-foreground">{copy.priorityOverviewDescription}</p>
      </div>
      {#if page.groups.length === 0}
        <Empty.Root class="items-start border-y px-0 text-left">
          <Empty.Header class="items-start text-left">
            <Empty.Title>{copy.noRecentErrors}</Empty.Title>
            <Empty.Description>{copy.noIssueGroups}</Empty.Description>
          </Empty.Header>
        </Empty.Root>
      {:else}
        <div class="grid gap-3 sm:grid-cols-2">
          {#each page.groups as group}
            <article class="grid gap-3 rounded-lg border p-4">
              <div class="flex flex-wrap items-start justify-between gap-3">
                <div class="grid min-w-0 gap-1">
                  <h4 class="break-words font-semibold">{group.feature} · {group.operation}</h4>
                  <p class="text-sm text-muted-foreground">{label("protocols", group.protocol)} · {label("errorClasses", group.errorClass)}</p>
                </div>
                <Badge variant={outcomeVariant(group.outcome)}>{label("outcomes", group.outcome)}</Badge>
              </div>
              <dl class="grid grid-cols-2 gap-3 text-sm">
                <div><dt class="text-muted-foreground">{copy.issueCount}</dt><dd class="font-medium tabular-nums">{numberFormatter.format(group.count)}</dd></div>
                <div><dt class="text-muted-foreground">{copy.lastSeen}</dt><dd>{formatDate(group.lastSeen)}</dd></div>
              </dl>
              <Button class="w-fit" href={groupHref(group)} size="sm" variant="outline">{copy.filterThisGroup}</Button>
            </article>
          {/each}
        </div>
      {/if}
    </section>

    <section aria-labelledby="issue-timeline-title" class="grid gap-3">
      <div class="flex flex-wrap items-end justify-between gap-2">
        <div class="grid gap-1">
          <h3 id="issue-timeline-title" class="text-base font-semibold">{copy.eventTimeline}</h3>
          <p class="text-sm text-muted-foreground">{copy.eventTimelineDescription}</p>
        </div>
        {#if page.errorsTruncated && page.nextCursor}<Badge variant="outline">{copy.moreIssues}</Badge>{/if}
      </div>

      {#if page.errorSamples.length === 0}
        <Empty.Root class="items-start border-y px-0 text-left">
          <Empty.Header class="items-start text-left">
            <Empty.Title>{copy.noRecentErrors}</Empty.Title>
            <Empty.Description>{copy.noRecentErrorsDescription}</Empty.Description>
          </Empty.Header>
        </Empty.Root>
      {:else}
        <ol class="grid gap-3 border-l pl-4 sm:pl-6">
          {#each page.errorSamples as sample (sample.id)}
            <li class="relative grid gap-3 rounded-lg border bg-card p-4">
              <span class="absolute -left-[1.375rem] top-5 size-2 rounded-full bg-destructive ring-4 ring-background sm:-left-[1.625rem]" aria-hidden="true"></span>
              <div class="flex flex-wrap items-start justify-between gap-3">
                <div class="grid min-w-0 gap-1">
                  <p class="font-medium">{sample.feature} · {sample.operation}</p>
                  <p class="text-sm text-muted-foreground">{formatDate(sample.occurredAt)} · {label("protocols", sample.protocol)}</p>
                </div>
                <Badge variant={outcomeVariant(sample.outcome)}>{label("outcomes", sample.outcome)}</Badge>
              </div>
              <dl class="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <div><dt class="text-muted-foreground">{copy.errorClass}</dt><dd>{label("errorClasses", sample.errorClass)}</dd></div>
                <div><dt class="text-muted-foreground">{copy.duration}</dt><dd class="tabular-nums">{formatDuration(sample.durationMs)}</dd></div>
                <div><dt class="text-muted-foreground">{copy.userId}</dt><dd class="break-all font-mono text-xs">{sample.userId ?? copy.noUser}</dd></div>
                <div><dt class="text-muted-foreground">{copy.requestId}</dt><dd class="break-all font-mono text-xs">{sample.requestId ?? copy.noRequestId}</dd></div>
              </dl>
              <details>
                <summary class="cursor-pointer text-sm font-medium">{copy.eventDetails}</summary>
                <dl class="grid gap-2 pt-3 text-xs">
                  <div><dt class="text-muted-foreground">{copy.eventId}</dt><dd class="break-all font-mono">{sample.id}</dd></div>
                  <div><dt class="text-muted-foreground">{copy.authMode}</dt><dd>{label("authModes", sample.authMode)}</dd></div>
                  <div><dt class="text-muted-foreground">{copy.surface}</dt><dd>{label("surfaces", sample.surface)}</dd></div>
                </dl>
              </details>
            </li>
          {/each}
        </ol>
      {/if}

      <footer class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {#if page.errorsTruncated && page.nextCursor}
        <Button href={issueHref(activeView, { cursor: page.nextCursor })} variant="outline">{copy.nextPage}</Button>
        {/if}
      </footer>
    </section>

    <section aria-labelledby="runtime-issues-title" class="grid gap-3 border-t pt-4">
      <div class="grid gap-1">
        <h3 id="runtime-issues-title" class="text-base font-semibold">{copy.runtimeIssues}</h3>
        <p class="text-sm text-muted-foreground">{copy.runtimeIssuesDescription}</p>
      </div>
      {#if page.runtimeIssues.length === 0}
        <p class="text-sm text-muted-foreground">{copy.noRuntimeIssues}</p>
      {:else}
        <details class="rounded-lg border px-4 py-3">
          <summary class="cursor-pointer text-sm font-medium">{copy.showRuntimeIssues.replace("{count}", String(page.runtimeIssues.length))}</summary>
          <ul class="grid gap-3 pt-3">
            {#each page.runtimeIssues as issue (issue.id)}
              <li class="grid gap-1 border-t pt-3 text-sm first:border-t-0 first:pt-0">
                <div class="flex flex-wrap items-center gap-2"><Badge variant={issue.level === "error" ? "destructive" : "outline"}>{issue.level}</Badge><span class="font-medium">{issue.event}</span><span class="text-muted-foreground">{formatDate(issue.occurredAt)}</span></div>
                <dl class="grid gap-1 text-xs text-muted-foreground sm:grid-cols-3">
                  <div><dt class="inline">{copy.route}: </dt><dd class="inline break-all">{issue.route ?? "—"}</dd></div>
                  <div><dt class="inline">{copy.status}: </dt><dd class="inline">{issue.status ?? "—"}</dd></div>
                  <div><dt class="inline">{copy.requestId}: </dt><dd class="inline break-all font-mono">{issue.requestId ?? copy.noRequestId}</dd></div>
                </dl>
              </li>
            {/each}
          </ul>
        </details>
      {/if}
    </section>
  {/if}
</section>
