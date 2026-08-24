<script lang="ts">
import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
import AdminWorkspace from "@/features/admin/components/AdminWorkspace.svelte";
import {
  auditActionLabel,
  auditChannelLabel,
  auditMetadataLabel,
  auditOutcomeLabel,
  auditTargetLabel,
} from "@/features/admin/lib/admin-audit-display";
import { buildAdminAuditHref } from "@/features/admin/lib/audit-page-hrefs";
import PageHeader from "$lib/components/PageHeader.svelte";
import { Badge } from "$lib/components/ui/badge/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import * as Empty from "$lib/components/ui/empty/index.js";
import * as Field from "$lib/components/ui/field/index.js";
import { Input } from "$lib/components/ui/input/index.js";
import * as Item from "$lib/components/ui/item/index.js";
import * as NativeSelect from "$lib/components/ui/native-select/index.js";
import * as Table from "$lib/components/ui/table/index.js";
import type { PageData } from "./$types";

export let data: PageData;

const formatDate = new Intl.DateTimeFormat(data.locale, {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Shanghai",
});

function identity(
  value: { id: string; name: string | null; username: string | null } | null,
) {
  if (!value) return null;
  return {
    id: value.id,
    label: value.name || value.username || value.id,
  };
}

function nextHref(cursor: string) {
  return buildAdminAuditHref(data.filters, cursor);
}

function newestHref() {
  return buildAdminAuditHref(data.filters);
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

<AdminWorkspace>
  {#snippet header()}
    <PageHeader
      title={data.copy.audit.title}
      description={data.copy.audit.subtitle}
      eyebrow={data.copy.admin.title}
    />
  {/snippet}

  {#snippet controls()}
    <section aria-labelledby="audit-filters-title" class="grid gap-4 border-y py-4">
      <h2 id="audit-filters-title" class="text-base font-semibold">
        {data.copy.audit.filters}
      </h2>
      <form method="GET">
        <Field.Group class="gap-4">
          <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
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

          <details>
            <summary class="cursor-pointer py-1 text-sm font-medium">
              {data.copy.audit.advancedFilters}
            </summary>
            <div class="grid gap-4 pt-4 sm:grid-cols-2 xl:grid-cols-5">
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
          </details>

          <Field.Field orientation="horizontal" class="gap-2">
            <Button class="flex-1 sm:flex-none" type="submit">{data.copy.audit.apply}</Button>
            <Button class="flex-1 sm:flex-none" href="/admin/audit" variant="outline">{data.copy.audit.clear}</Button>
          </Field.Field>
        </Field.Group>
      </form>
    </section>
  {/snippet}

  <section aria-labelledby="audit-records-title" class="grid gap-3">
    <div class="flex flex-wrap items-end justify-between gap-2">
      <div class="grid gap-1">
        <h2 id="audit-records-title" class="text-lg font-semibold">{data.copy.audit.records}</h2>
        <p class="text-sm text-muted-foreground">{pageLabel()}</p>
      </div>
    </div>

    <div class="min-w-0">
      {#if data.rows.length === 0}
        <Empty.Root class="items-start px-0 text-left">
          <Empty.Header class="items-start text-left">
            <Empty.Title>{data.copy.audit.noRecords}</Empty.Title>
          </Empty.Header>
        </Empty.Root>
      {:else}
        <Item.Group class="gap-0 border-y py-1 xl:hidden" role="list">
          {#each data.rows as row, index (row.id)}
            {@const actor = identity(row.user)}
            {@const subject = identity(row.subjectUser)}
            <Item.Root role="listitem" variant="default" class="grid gap-3 px-1 py-3">
              <Item.Content class="min-w-0">
                <Item.Title>{auditActionLabel(data.locale, row.action)}</Item.Title>
                <Item.Description>{formatDate.format(new Date(row.createdAt))}</Item.Description>
              </Item.Content>
              <Item.Actions class="flex-wrap">
                <Badge variant={row.outcome === "success" ? "secondary" : "destructive"}>{auditOutcomeLabel(data.locale, row.outcome)}</Badge>
                <Badge variant="outline">{auditChannelLabel(data.locale, row.channel)}</Badge>
                <ChevronRightIcon aria-hidden="true" data-icon="inline-end" />
              </Item.Actions>
              <Item.Footer>
                <div class="grid w-full gap-2 text-xs">
                  <dl class="grid gap-2">
                    {#if actor}<div><dt class="text-muted-foreground">{data.copy.audit.actorColumn}</dt><dd>{actor.label} <span class="break-all font-mono text-muted-foreground">{actor.id}</span></dd></div>{/if}
                    {#if subject}<div><dt class="text-muted-foreground">{data.copy.audit.subjectColumn}</dt><dd>{subject.label} <span class="break-all font-mono text-muted-foreground">{subject.id}</span></dd></div>{/if}
                    {#if row.oauthClientId}<div><dt class="text-muted-foreground">{data.copy.audit.clientColumn}</dt><dd>{row.clientName ?? row.oauthClientId}</dd></div>{/if}
                    {#if row.targetType}<div><dt class="text-muted-foreground">{data.copy.audit.target}</dt><dd>{auditTargetLabel(data.locale, row.targetType)}{row.targetId ? ` · ${row.targetId}` : ""}</dd></div>{/if}
                  </dl>
                  {#if row.metadata}
                    <details class="pt-1">
                      <summary class="cursor-pointer font-medium">{data.copy.audit.details}</summary>
                      <dl class="grid gap-2 pt-2">
                        {#each Object.entries(row.metadata) as [key, value]}
                          <div><dt class="text-muted-foreground">{auditMetadataLabel(data.locale, key)}</dt><dd class="break-words">{displayValue(value)}</dd></div>
                        {/each}
                      </dl>
                    </details>
                  {/if}
                </div>
              </Item.Footer>
            </Item.Root>
            {#if index < data.rows.length - 1}<Item.Separator class="my-0" />{/if}
          {/each}
        </Item.Group>

        <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
        <div
          class="hidden min-w-0 max-w-full overflow-x-auto [&>[data-slot=table-container]]:overflow-visible xl:block"
          tabindex="0"
          role="region"
          aria-label={data.copy.audit.records}
        >
          <Table.Root class="min-w-[1100px]">
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
                  <Table.Cell>{actor?.label ?? "—"}{#if actor}<span class="block max-w-44 truncate font-mono text-xs text-muted-foreground">{actor.id}</span>{/if}</Table.Cell>
                  <Table.Cell>{subject?.label ?? "—"}{#if subject}<span class="block max-w-44 truncate font-mono text-xs text-muted-foreground">{subject.id}</span>{/if}</Table.Cell>
                  <Table.Cell>{row.clientName ?? row.oauthClientId ?? "—"}</Table.Cell>
                  <Table.Cell class="text-center">{auditChannelLabel(data.locale, row.channel)}</Table.Cell>
                  <Table.Cell class="text-center"><Badge variant={row.outcome === "success" ? "secondary" : "destructive"}>{auditOutcomeLabel(data.locale, row.outcome)}</Badge></Table.Cell>
                  <Table.Cell>{row.targetType ? auditTargetLabel(data.locale, row.targetType) : "—"}{row.targetId ? ` · ${row.targetId}` : ""}</Table.Cell>
                  <Table.Cell class="max-w-72 text-xs">{#if row.metadata}<dl class="grid gap-1">{#each Object.entries(row.metadata) as [key, value]}<div><dt class="inline text-muted-foreground">{auditMetadataLabel(data.locale, key)}: </dt><dd class="inline break-words">{displayValue(value)}</dd></div>{/each}</dl>{:else}—{/if}</Table.Cell>
                </Table.Row>
              {/each}
            </Table.Body>
          </Table.Root>
        </div>
      {/if}
    </div>

    <footer class="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-end">
      <span class="text-sm text-muted-foreground">{pageLabel()}</span>
      <div class="flex gap-2">
        {#if data.pagination.hasCursor}<Button class="flex-1" href={newestHref()} variant="ghost">{data.copy.audit.newest}</Button>{/if}
        {#if data.pagination.nextCursor}<Button class="flex-1" href={nextHref(data.pagination.nextCursor)} variant="outline">{data.copy.audit.next}</Button>{/if}
      </div>
    </footer>
  </section>
</AdminWorkspace>
