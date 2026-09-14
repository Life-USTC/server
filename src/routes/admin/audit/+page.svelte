<script lang="ts">
import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
import AdminFeatureIssues from "@/features/admin/components/AdminFeatureIssues.svelte";
import AdminTableShell from "@/features/admin/components/AdminTableShell.svelte";
import AdminWorkspace from "@/features/admin/components/AdminWorkspace.svelte";
import {
  auditActionLabel,
  auditChannelLabel,
  auditMetadataLabel,
  auditOutcomeLabel,
  auditTargetLabel,
} from "@/features/admin/lib/admin-audit-display";
import { buildAdminAuditHref } from "@/features/admin/lib/audit-page-hrefs";
import { replaceState } from "$app/navigation";
import { page as appPage } from "$app/stores";
import DashboardPanel from "$lib/components/dashboard/DashboardPanel.svelte";
import PageHeader from "$lib/components/PageHeader.svelte";
import { Badge } from "$lib/components/ui/badge/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import * as Collapsible from "$lib/components/ui/collapsible/index.js";
import * as Empty from "$lib/components/ui/empty/index.js";
import * as Field from "$lib/components/ui/field/index.js";
import { Input } from "$lib/components/ui/input/index.js";
import * as NativeSelect from "$lib/components/ui/native-select/index.js";
import * as Table from "$lib/components/ui/table/index.js";
import * as Tabs from "$lib/components/ui/tabs/index.js";
import type { PageData } from "./$types";

type AdminTab = "operations" | "runtime" | "audit";

export let data: PageData;

const formatDate = new Intl.DateTimeFormat(data.locale, {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Shanghai",
});

let auditFiltersOpen = false;

$: requestedTab = $appPage.url.searchParams.get("admin_tab");
$: activeTab = isAdminTab(requestedTab) ? requestedTab : "operations";
$: hasAdvancedAuditFilters = Boolean(
  data.filters.actor ||
    data.filters.subject ||
    data.filters.client ||
    data.filters.targetType ||
    data.filters.targetId,
);
$: if (hasAdvancedAuditFilters) auditFiltersOpen = true;

function isAdminTab(value: string | null): value is AdminTab {
  return value === "operations" || value === "runtime" || value === "audit";
}

function identity(
  value: { id: string; name: string | null; username: string | null } | null,
) {
  if (!value) return null;
  return {
    id: value.id,
    label: value.name || value.username || value.id,
  };
}

function issueQuery(issues: PageData["issues"]) {
  return {
    issue_actor: issues.filters.actor,
    issue_days: String(issues.days),
    issue_feature: issues.filters.feature,
    issue_operation: issues.filters.operation,
    issue_outcome: issues.filters.outcome,
    issue_protocol: issues.filters.protocol,
    issue_view: issues.view,
  };
}

function auditHref(current: PageData, cursor?: string) {
  const url = new URL(
    buildAdminAuditHref(current.filters, cursor),
    "https://admin.local",
  );
  for (const [key, value] of Object.entries(issueQuery(current.issues))) {
    if (value) url.searchParams.set(key, value);
  }
  url.searchParams.set("admin_tab", activeTab);
  return `${url.pathname}${url.search}`;
}

function auditClearHref(current: PageData) {
  const url = new URL("/admin/audit", "https://admin.local");
  for (const [key, value] of Object.entries(issueQuery(current.issues))) {
    if (value) url.searchParams.set(key, value);
  }
  url.searchParams.set("admin_tab", activeTab);
  return `${url.pathname}${url.search}`;
}

function tabHref(tab: AdminTab) {
  const url = new URL($appPage.url);
  url.searchParams.set("admin_tab", tab);
  return `${url.pathname}${url.search}${url.hash}`;
}

function selectTab(value: string) {
  if (isAdminTab(value)) replaceState(tabHref(value), {});
}

function pageLabel() {
  return data.copy.audit.page
    .replace("{shown}", String(data.rows.length))
    .replace("{total}", String(data.pagination.total));
}

function displayValue(value: unknown) {
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "boolean") return value ? "✓" : "—";
  return String(value);
}
</script>

<svelte:head><title>{data.copy.audit.title} - Life@USTC</title></svelte:head>

<AdminWorkspace compact>
  {#snippet header()}
    <PageHeader
      class="py-0 md:py-0"
      title={data.copy.audit.title}
      titleClass="text-xl sm:text-2xl"
    />
  {/snippet}

  <Tabs.Root
    aria-label={data.copy.audit.title}
    value={activeTab}
    onValueChange={selectTab}
    class="min-w-0 gap-4"
  >
    <Tabs.List class="grid w-full grid-cols-3" variant="line">
      <Tabs.Trigger class="min-w-0 truncate px-2 sm:px-3" value="operations">{data.copy.telemetry.recentErrors}</Tabs.Trigger>
      <Tabs.Trigger class="min-w-0 truncate px-2 sm:px-3" value="runtime">{data.copy.telemetry.runtimeIssues}</Tabs.Trigger>
      <Tabs.Trigger class="min-w-0 truncate px-2 sm:px-3" value="audit">{data.copy.audit.records}</Tabs.Trigger>
    </Tabs.List>

    <Tabs.Content value="operations" class="m-0 min-w-0">
      <AdminFeatureIssues
        data={data.issues}
        copy={data.copy.telemetry}
        locale={data.locale}
        auditFilters={data.filters}
        advancedFiltersLabel={data.copy.audit.advancedFilters}
        adminTab="operations"
        section="operations"
      />
    </Tabs.Content>

    <Tabs.Content value="runtime" class="m-0 min-w-0">
      <AdminFeatureIssues
        data={data.issues}
        copy={data.copy.telemetry}
        locale={data.locale}
        auditFilters={data.filters}
        advancedFiltersLabel={data.copy.audit.advancedFilters}
        adminTab="runtime"
        section="runtime"
      />
    </Tabs.Content>

    <Tabs.Content value="audit" class="m-0 min-w-0">
      <div class="grid min-w-0 gap-4">
        <DashboardPanel id="audit-filters" title={data.copy.audit.filters}>
          <form method="GET">
            {#each Object.entries(issueQuery(data.issues)) as [key, value]}
              {#if value}<input type="hidden" name={key} value={value} />{/if}
            {/each}
            <input type="hidden" name="admin_tab" value="audit" />
            <Field.Group class="gap-3">
              <div class="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-5 [&>*]:min-w-0">
                <Field.Field>
                  <Field.Label for="audit-action">{data.copy.audit.action}</Field.Label>
                  <NativeSelect.Root class="w-full" id="audit-action" name="action">
                    <NativeSelect.Option value="">{data.copy.audit.all}</NativeSelect.Option>
                    {#each data.actions as action}
                      <NativeSelect.Option value={action} selected={data.filters.action === action}>
                        {auditActionLabel(data.locale, action)}
                      </NativeSelect.Option>
                    {/each}
                  </NativeSelect.Root>
                </Field.Field>
                <Field.Field>
                  <Field.Label for="audit-outcome">{data.copy.audit.outcome}</Field.Label>
                  <NativeSelect.Root class="w-full" id="audit-outcome" name="outcome">
                    <NativeSelect.Option value="">{data.copy.audit.all}</NativeSelect.Option>
                    {#each data.outcomes as outcome}
                      <NativeSelect.Option value={outcome} selected={data.filters.outcome === outcome}>
                        {auditOutcomeLabel(data.locale, outcome)}
                      </NativeSelect.Option>
                    {/each}
                  </NativeSelect.Root>
                </Field.Field>
                <Field.Field>
                  <Field.Label for="audit-channel">{data.copy.audit.channel}</Field.Label>
                  <NativeSelect.Root class="w-full" id="audit-channel" name="channel">
                    <NativeSelect.Option value="">{data.copy.audit.all}</NativeSelect.Option>
                    {#each data.channels as channel}
                      <NativeSelect.Option value={channel} selected={data.filters.channel === channel}>
                        {auditChannelLabel(data.locale, channel)}
                      </NativeSelect.Option>
                    {/each}
                  </NativeSelect.Root>
                </Field.Field>
                <Field.Field>
                  <Field.Label for="audit-from">{data.copy.audit.from}</Field.Label>
                  <Input id="audit-from" type="date" name="from" value={data.filters.from ?? ""} />
                </Field.Field>
                <Field.Field>
                  <Field.Label for="audit-to">{data.copy.audit.to}</Field.Label>
                  <Input id="audit-to" type="date" name="to" value={data.filters.to ?? ""} />
                </Field.Field>
              </div>

              <Collapsible.Root bind:open={auditFiltersOpen} class="rounded-md border bg-muted/20">
                <Collapsible.Trigger class="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm font-medium hover:bg-muted/40">
                  <span>{data.copy.audit.advancedFilters}</span>
                  <ChevronRightIcon aria-hidden="true" class="shrink-0 transition-transform data-[state=open]:rotate-90" />
                </Collapsible.Trigger>
                <Collapsible.Content class="border-t p-3 data-[state=closed]:hidden">
                  <div class="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-5 [&>*]:min-w-0">
                    <Field.Field>
                      <Field.Label for="audit-actor">{data.copy.audit.actor}</Field.Label>
                      <Input id="audit-actor" name="actor" value={data.filters.actor ?? ""} />
                    </Field.Field>
                    <Field.Field>
                      <Field.Label for="audit-subject">{data.copy.audit.subject}</Field.Label>
                      <Input id="audit-subject" name="subject" value={data.filters.subject ?? ""} />
                    </Field.Field>
                    <Field.Field>
                      <Field.Label for="audit-client">{data.copy.audit.client}</Field.Label>
                      <Input id="audit-client" name="client" value={data.filters.client ?? ""} />
                    </Field.Field>
                    <Field.Field>
                      <Field.Label for="audit-target-type">{data.copy.audit.targetType}</Field.Label>
                      <Input id="audit-target-type" name="targetType" value={data.filters.targetType ?? ""} />
                    </Field.Field>
                    <Field.Field>
                      <Field.Label for="audit-target-id">{data.copy.audit.targetId}</Field.Label>
                      <Input id="audit-target-id" name="targetId" value={data.filters.targetId ?? ""} />
                    </Field.Field>
                  </div>
                </Collapsible.Content>
              </Collapsible.Root>

              <Field.Field orientation="horizontal" class="gap-2">
                <Button type="submit">{data.copy.audit.apply}</Button>
                <Button href={auditClearHref(data)} variant="outline">{data.copy.audit.clear}</Button>
              </Field.Field>
            </Field.Group>
          </form>
        </DashboardPanel>

        <DashboardPanel id="audit-records" title={data.copy.audit.records}>
          <div class="flex flex-wrap items-center justify-between gap-2">
            <p class="text-xs text-muted-foreground">{pageLabel()}</p>
          </div>

          {#if data.rows.length === 0}
            <Empty.Root class="items-start px-0 text-left">
              <Empty.Header class="items-start text-left">
                <Empty.Title>{data.copy.audit.noRecords}</Empty.Title>
              </Empty.Header>
            </Empty.Root>
          {:else}
            <ol class="grid max-h-[36rem] min-w-0 gap-1 overflow-y-auto rounded-md border p-1 xl:hidden" aria-label={data.copy.audit.records}>
              {#each data.rows as row (row.id)}
                {@const actor = identity(row.user)}
                {@const subject = identity(row.subjectUser)}
                <li class="min-w-0 rounded-sm border bg-card">
                  <details name="audit-record">
                    <summary class="flex cursor-pointer flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm">
                      <span class="grid min-w-0 gap-0.5">
                        <span class="font-medium">{auditActionLabel(data.locale, row.action)}</span>
                        <span class="text-xs text-muted-foreground">{formatDate.format(new Date(row.createdAt))} · {auditChannelLabel(data.locale, row.channel)}</span>
                      </span>
                      <Badge variant={row.outcome === "success" ? "secondary" : "destructive"}>{auditOutcomeLabel(data.locale, row.outcome)}</Badge>
                    </summary>
                    <dl class="grid min-w-0 gap-3 border-t bg-muted/20 p-3 text-xs [&>div]:min-w-0">
                      {#if actor}<div><dt class="text-muted-foreground">{data.copy.audit.actorColumn}</dt><dd class="break-all">{actor.label}<span class="block font-mono text-muted-foreground">{actor.id}</span></dd></div>{/if}
                      {#if subject}<div><dt class="text-muted-foreground">{data.copy.audit.subjectColumn}</dt><dd class="break-all">{subject.label}<span class="block font-mono text-muted-foreground">{subject.id}</span></dd></div>{/if}
                      {#if row.oauthClientId}<div><dt class="text-muted-foreground">{data.copy.audit.clientColumn}</dt><dd class="break-all">{row.clientName ?? row.oauthClientId}</dd></div>{/if}
                      {#if row.targetType}<div><dt class="text-muted-foreground">{data.copy.audit.target}</dt><dd class="break-all">{auditTargetLabel(data.locale, row.targetType)}{row.targetId ? ` · ${row.targetId}` : ""}</dd></div>{/if}
                      {#if row.metadata}{#each Object.entries(row.metadata) as [key,value]}<div><dt class="text-muted-foreground">{auditMetadataLabel(data.locale,key)}</dt><dd class="break-all">{displayValue(value)}</dd></div>{/each}{/if}
                    </dl>
                  </details>
                </li>
              {/each}
            </ol>

            <AdminTableShell class="hidden xl:block" label={data.copy.audit.records}>
              <Table.Root class="min-w-[72rem]">
                <Table.Caption class="sr-only">{data.copy.audit.records}</Table.Caption>
                <Table.Header>
                  <Table.Row>
                    <Table.Head>{data.copy.audit.time}</Table.Head>
                    <Table.Head>{data.copy.audit.action}</Table.Head>
                    <Table.Head>{data.copy.audit.actorColumn}</Table.Head>
                    <Table.Head>{data.copy.audit.subjectColumn}</Table.Head>
                    <Table.Head>{data.copy.audit.clientColumn}</Table.Head>
                    <Table.Head class="text-center">{data.copy.audit.channel}</Table.Head>
                    <Table.Head class="text-center">{data.copy.audit.outcome}</Table.Head>
                    <Table.Head>{data.copy.audit.target}</Table.Head>
                    <Table.Head>{data.copy.audit.details}</Table.Head>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {#each data.rows as row (row.id)}
                    {@const actor = identity(row.user)}
                    {@const subject = identity(row.subjectUser)}
                    <Table.Row class="align-top">
                      <Table.Cell class="whitespace-nowrap">{formatDate.format(new Date(row.createdAt))}</Table.Cell>
                      <Table.Cell>{auditActionLabel(data.locale, row.action)}</Table.Cell>
                      <Table.Cell class="max-w-0">{actor?.label ?? "—"}{#if actor}<span class="block max-w-full truncate font-mono text-xs text-muted-foreground" title={actor.id}>{actor.id}</span>{/if}</Table.Cell>
                      <Table.Cell class="max-w-0">{subject?.label ?? "—"}{#if subject}<span class="block max-w-full truncate font-mono text-xs text-muted-foreground" title={subject.id}>{subject.id}</span>{/if}</Table.Cell>
                      <Table.Cell class="max-w-0"><span class="block max-w-full truncate" title={row.clientName ?? row.oauthClientId ?? "—"}>{row.clientName ?? row.oauthClientId ?? "—"}</span></Table.Cell>
                      <Table.Cell class="text-center">{auditChannelLabel(data.locale, row.channel)}</Table.Cell>
                      <Table.Cell class="text-center"><Badge variant={row.outcome === "success" ? "secondary" : "destructive"}>{auditOutcomeLabel(data.locale, row.outcome)}</Badge></Table.Cell>
                      <Table.Cell class="max-w-0"><span class="block max-w-full truncate" title={row.targetType ? `${auditTargetLabel(data.locale, row.targetType)}${row.targetId ? ` · ${row.targetId}` : ""}` : "—"}>{row.targetType ? auditTargetLabel(data.locale, row.targetType) : "—"}{row.targetId ? ` · ${row.targetId}` : ""}</span></Table.Cell>
                      <Table.Cell class="max-w-72 text-xs">
                        {#if row.metadata}
                          <details>
                            <summary class="cursor-pointer font-medium">{data.copy.audit.details}</summary>
                            <dl class="grid gap-1 pt-2">
                              {#each Object.entries(row.metadata) as [key, value]}
                                <div><dt class="inline text-muted-foreground">{auditMetadataLabel(data.locale, key)}: </dt><dd class="inline break-words">{displayValue(value)}</dd></div>
                              {/each}
                            </dl>
                          </details>
                        {:else}—{/if}
                      </Table.Cell>
                    </Table.Row>
                  {/each}
                </Table.Body>
              </Table.Root>
            </AdminTableShell>
          {/if}

          <footer class="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span class="text-xs text-muted-foreground">{pageLabel()}</span>
            <div class="flex gap-2">
              {#if data.pagination.hasCursor}<Button class="flex-1" href={auditHref(data)} variant="ghost">{data.copy.audit.newest}</Button>{/if}
              {#if data.pagination.nextCursor}<Button class="flex-1" href={auditHref(data, data.pagination.nextCursor)} variant="outline">{data.copy.audit.next}</Button>{/if}
            </div>
          </footer>
        </DashboardPanel>
      </div>
    </Tabs.Content>
  </Tabs.Root>
</AdminWorkspace>
