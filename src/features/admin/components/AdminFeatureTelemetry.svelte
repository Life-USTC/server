<script lang="ts">
import AdminListShell from "@/features/admin/components/AdminListShell.svelte";
import AdminTableShell from "@/features/admin/components/AdminTableShell.svelte";
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

type PageData = Awaited<ReturnType<typeof readAdminFeatureTelemetry>> & {
  locale: string;
  copy: { experience: typeof messages.adminExperience };
};

export let data: PageData;

$: numberFormatter = new Intl.NumberFormat(data.locale);
$: durationFormatter = new Intl.NumberFormat(data.locale, {
  maximumFractionDigits: 1,
});

$: total = data.rows.reduce((sum, row) => sum + row.total, 0);
$: rejected = data.rows.reduce((sum, row) => sum + row.rejectedCount, 0);
$: errors = data.rows.reduce((sum, row) => sum + row.errorCount, 0);
$: unknown = data.rows.reduce((sum, row) => sum + row.unknownCount, 0);

function label(group: string, value: string) {
  const labels = (data.copy.experience as Record<string, unknown>)[group];
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
</script>

    <section aria-labelledby="experience-window-title" class="grid gap-4 border-y py-4">
      <div class="flex flex-wrap items-baseline justify-between gap-3">
        <div class="grid gap-1">
          <h2 id="experience-window-title" class="text-base font-semibold">{data.copy.experience.window}</h2>
          <p class="text-sm text-muted-foreground">
            {data.copy.experience.coverage
              .replace("{from}", data.coverage.fromDay)
              .replace("{to}", data.coverage.endDayExclusive)}
          </p>
        </div>
      </div>

      <form method="GET">
        <input type="hidden" name="days" value={data.days} />
        <Field.Group class="gap-4">
          <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <Field.Field>
              <Field.Label for="experience-feature">{data.copy.experience.feature}</Field.Label>
              <NativeSelect.Root class="w-full" id="experience-feature" name="feature">
                <NativeSelect.Option value="">{data.copy.experience.all}</NativeSelect.Option>
                {#each data.catalog.features as feature}
                  <NativeSelect.Option value={feature} selected={data.filters.feature === feature}>{label("features", feature)}</NativeSelect.Option>
                {/each}
              </NativeSelect.Root>
            </Field.Field>
            <Field.Field>
              <Field.Label for="experience-operation">{data.copy.experience.operation}</Field.Label>
              <Input id="experience-operation" name="operation" value={data.filters.operation ?? ""} placeholder={data.copy.experience.operationPlaceholder} />
            </Field.Field>
            <Field.Field>
              <Field.Label for="experience-protocol">{data.copy.experience.protocol}</Field.Label>
              <NativeSelect.Root class="w-full" id="experience-protocol" name="protocol">
                <NativeSelect.Option value="">{data.copy.experience.all}</NativeSelect.Option>
                {#each data.catalog.protocols as protocol}
                  <NativeSelect.Option value={protocol} selected={data.filters.protocol === protocol}>{label("protocols", protocol)}</NativeSelect.Option>
                {/each}
              </NativeSelect.Root>
            </Field.Field>
            <Field.Field>
              <Field.Label for="experience-surface">{data.copy.experience.surface}</Field.Label>
              <NativeSelect.Root class="w-full" id="experience-surface" name="surface">
                <NativeSelect.Option value="">{data.copy.experience.all}</NativeSelect.Option>
                {#each data.catalog.surfaces as surface}
                  <NativeSelect.Option value={surface} selected={data.filters.surface === surface}>{label("surfaces", surface)}</NativeSelect.Option>
                {/each}
              </NativeSelect.Root>
            </Field.Field>
            <Field.Field>
              <Field.Label for="experience-auth">{data.copy.experience.authMode}</Field.Label>
              <NativeSelect.Root class="w-full" id="experience-auth" name="authMode">
                <NativeSelect.Option value="">{data.copy.experience.all}</NativeSelect.Option>
                {#each data.catalog.authModes as authMode}
                  <NativeSelect.Option value={authMode} selected={data.filters.authMode === authMode}>{label("authModes", authMode)}</NativeSelect.Option>
                {/each}
              </NativeSelect.Root>
            </Field.Field>
            <Field.Field>
              <Field.Label for="experience-outcome">{data.copy.experience.outcome}</Field.Label>
              <NativeSelect.Root class="w-full" id="experience-outcome" name="outcome">
                <NativeSelect.Option value="">{data.copy.experience.all}</NativeSelect.Option>
                {#each data.catalog.outcomes as outcome}
                  <NativeSelect.Option value={outcome} selected={data.filters.outcome === outcome}>{label("outcomes", outcome)}</NativeSelect.Option>
                {/each}
              </NativeSelect.Root>
            </Field.Field>
          </div>
          <Field.Field orientation="horizontal" class="gap-2">
            <Button class="flex-1 sm:flex-none" type="submit">{data.copy.experience.apply}</Button>
            <Button class="flex-1 sm:flex-none" href="/admin/analytics" variant="outline">{data.copy.experience.clear}</Button>
          </Field.Field>
        </Field.Group>
      </form>
    </section>

  {#if data.status.state === "unavailable"}
    <Alert.Root variant="destructive">
      <Alert.Title>{data.copy.experience.unavailable}</Alert.Title>
      <Alert.Description>
        {data.status.reason === "not_configured" || data.status.reason === "invalid_config"
          ? data.copy.experience.unavailableConfiguration
          : data.copy.experience.unavailableQuery}
      </Alert.Description>
    </Alert.Root>
  {:else if data.status.state === "empty"}
    <Empty.Root class="items-start border-y px-0 text-left">
      <Empty.Header class="items-start text-left">
        <Empty.Title>{data.copy.experience.notObserved}</Empty.Title>
        <Empty.Description>{data.copy.experience.notObservedDescription}</Empty.Description>
      </Empty.Header>
    </Empty.Root>
  {:else}
    <section aria-labelledby="experience-summary-title" class="grid gap-3">
      <h2 id="experience-summary-title" class="text-lg font-semibold">{data.copy.experience.summary}</h2>
      <dl class="grid grid-cols-2 gap-x-6 gap-y-5 border-y py-4 xl:grid-cols-4">
        <div class="grid content-start gap-1"><dt class="text-sm text-muted-foreground">{data.copy.experience.total}</dt><dd class="text-2xl font-semibold tabular-nums">{numberFormatter.format(total)}</dd></div>
        <div class="grid content-start gap-1"><dt class="text-sm text-muted-foreground">{data.copy.experience.rejected}</dt><dd class="text-2xl font-semibold tabular-nums">{numberFormatter.format(rejected)}</dd></div>
        <div class="grid content-start gap-1"><dt class="text-sm text-muted-foreground">{data.copy.experience.errors}</dt><dd class="text-2xl font-semibold tabular-nums">{numberFormatter.format(errors)}</dd></div>
        <div class="grid content-start gap-1"><dt class="text-sm text-muted-foreground">{data.copy.experience.unknown}</dt><dd class="text-2xl font-semibold tabular-nums">{numberFormatter.format(unknown)}</dd></div>
      </dl>
    </section>

    <section aria-labelledby="experience-matrix-title" class="grid min-w-0 gap-3">
      <div class="flex flex-wrap items-end justify-between gap-2">
        <div class="grid gap-1">
          <h2 id="experience-matrix-title" class="text-lg font-semibold">{data.copy.experience.matrix}</h2>
          <p class="text-sm text-muted-foreground">{data.copy.experience.matrixDescription}</p>
        </div>
      </div>

      <AdminListShell class="xl:hidden py-1">
        <Item.Group class="gap-0">
          {#each data.rows as row, index (`${row.feature}-${row.operation}-${row.protocol}-${row.surface}-${row.authMode}-${row.outcome}`)}
            <Item.Root variant="default" class="grid gap-3 px-1 py-3">
              <Item.Content class="min-w-0">
                <Item.Title class="break-words">{row.feature} · {row.operation}</Item.Title>
                <Item.Description>{label("protocols", row.protocol)} · {label("surfaces", row.surface)} · {label("authModes", row.authMode)}</Item.Description>
              </Item.Content>
              <Item.Actions class="flex-wrap">
                <Badge variant={row.outcome === "success" ? "secondary" : row.outcome === "unknown" ? "outline" : "destructive"}>{label("outcomes", row.outcome)}</Badge>
                <span class="tabular-nums">{numberFormatter.format(row.total)}</span>
              </Item.Actions>
              <Item.Footer>
                <dl class="grid w-full grid-cols-2 gap-2 text-xs">
                  <div><dt class="text-muted-foreground">{data.copy.experience.rejected}</dt><dd class="tabular-nums">{numberFormatter.format(row.rejectedCount)}</dd></div>
                  <div><dt class="text-muted-foreground">{data.copy.experience.errors}</dt><dd class="tabular-nums">{numberFormatter.format(row.errorCount)}</dd></div>
                  <div><dt class="text-muted-foreground">{data.copy.experience.p50}</dt><dd class="tabular-nums">{metricWithUnit(row.p50WallMs)}</dd></div>
                  <div><dt class="text-muted-foreground">{data.copy.experience.p95}</dt><dd class="tabular-nums">{metricWithUnit(row.p95WallMs)}</dd></div>
                </dl>
              </Item.Footer>
            </Item.Root>
            {#if index < data.rows.length - 1}<Item.Separator class="my-0" />{/if}
          {/each}
        </Item.Group>
      </AdminListShell>

      <AdminTableShell class="hidden xl:block" label={data.copy.experience.matrix}>
        <Table.Root class="min-w-[75rem]">
          <Table.Caption class="sr-only">{data.copy.experience.matrix}</Table.Caption>
          <Table.Header>
            <Table.Row>
              <Table.Head>{data.copy.experience.feature}</Table.Head>
              <Table.Head>{data.copy.experience.operation}</Table.Head>
              <Table.Head>{data.copy.experience.protocol}</Table.Head>
              <Table.Head>{data.copy.experience.surface}</Table.Head>
              <Table.Head>{data.copy.experience.authMode}</Table.Head>
              <Table.Head>{data.copy.experience.outcome}</Table.Head>
              <Table.Head class="text-right">{data.copy.experience.total}</Table.Head>
              <Table.Head class="text-right">{data.copy.experience.rejected}</Table.Head>
              <Table.Head class="text-right">{data.copy.experience.errors}</Table.Head>
              <Table.Head class="text-right">{data.copy.experience.p50}</Table.Head>
              <Table.Head class="text-right">{data.copy.experience.p95}</Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {#each data.rows as row (`${row.feature}-${row.operation}-${row.protocol}-${row.surface}-${row.authMode}-${row.outcome}`)}
              <Table.Row class="align-top">
                <Table.Cell class="whitespace-nowrap">{row.feature}</Table.Cell>
                <Table.Cell class="max-w-0"><span class="block max-w-52 truncate" title={row.operation}>{row.operation}</span></Table.Cell>
                <Table.Cell>{label("protocols", row.protocol)}</Table.Cell>
                <Table.Cell>{label("surfaces", row.surface)}</Table.Cell>
                <Table.Cell>{label("authModes", row.authMode)}</Table.Cell>
                <Table.Cell><Badge variant={row.outcome === "success" ? "secondary" : row.outcome === "unknown" ? "outline" : "destructive"}>{label("outcomes", row.outcome)}</Badge></Table.Cell>
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
    </section>

  {/if}
    <section class="grid gap-3 border-t pt-4" aria-labelledby="experience-notes-title">
      <h2 id="experience-notes-title" class="text-lg font-semibold">{data.copy.experience.notes}</h2>
      <ul class="grid gap-2 text-sm text-muted-foreground">
        <li>{data.copy.experience.estimateNote}</li>
        <li>{data.copy.experience.durationNote}</li>
        <li>{data.copy.experience.coverageNote}</li>
        <li>{data.copy.experience.identityNote}</li>
        <li>{data.copy.experience.retentionNote}</li>
      </ul>
    </section>
