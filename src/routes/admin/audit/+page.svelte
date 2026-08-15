<script lang="ts">
import AdminWorkspace from "@/features/admin/components/AdminWorkspace.svelte";
import {
  auditActionLabel,
  auditChannelLabel,
  auditMetadataLabel,
  auditOutcomeLabel,
  auditTargetLabel,
} from "@/features/admin/lib/admin-audit-display";
import PageHeader from "$lib/components/PageHeader.svelte";
import { Badge } from "$lib/components/ui/badge/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import * as Card from "$lib/components/ui/card/index.js";
import * as Item from "$lib/components/ui/item/index.js";
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
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(data.filters)) {
    if (value) query.set(key, String(value));
  }
  query.set("cursor", cursor);
  return `/admin/audit?${query.toString()}`;
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
    <Card.Root>
      <Card.Header><Card.Title>{data.copy.audit.filters}</Card.Title></Card.Header>
      <Card.Content>
        <form method="GET" class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label class="grid gap-1 text-sm">{data.copy.audit.action}<select class="h-10 rounded-md border bg-background px-3" name="action"><option value="">{data.copy.audit.all}</option>{#each data.actions as action}<option value={action} selected={data.filters.action === action}>{auditActionLabel(data.locale, action)}</option>{/each}</select></label>
          <label class="grid gap-1 text-sm">{data.copy.audit.outcome}<select class="h-10 rounded-md border bg-background px-3" name="outcome"><option value="">{data.copy.audit.all}</option>{#each data.outcomes as outcome}<option value={outcome} selected={data.filters.outcome === outcome}>{auditOutcomeLabel(data.locale, outcome)}</option>{/each}</select></label>
          <label class="grid gap-1 text-sm">{data.copy.audit.channel}<select class="h-10 rounded-md border bg-background px-3" name="channel"><option value="">{data.copy.audit.all}</option>{#each data.channels as channel}<option value={channel} selected={data.filters.channel === channel}>{auditChannelLabel(data.locale, channel)}</option>{/each}</select></label>
          <div class="grid grid-cols-2 gap-3">
            <label class="grid gap-1 text-sm">{data.copy.audit.from}<input class="h-10 min-w-0 rounded-md border bg-transparent px-2" type="date" name="from" value={data.filters.from ?? ""} /></label>
            <label class="grid gap-1 text-sm">{data.copy.audit.to}<input class="h-10 min-w-0 rounded-md border bg-transparent px-2" type="date" name="to" value={data.filters.to ?? ""} /></label>
          </div>
          <details class="sm:col-span-2 lg:col-span-4">
            <summary class="cursor-pointer py-2 text-sm font-medium">{data.copy.audit.advancedFilters}</summary>
            <div class="grid gap-3 pt-2 sm:grid-cols-2 lg:grid-cols-4">
              <label class="grid gap-1 text-sm">{data.copy.audit.actor}<input class="h-10 rounded-md border bg-transparent px-3" name="actor" value={data.filters.actor ?? ""} /></label>
              <label class="grid gap-1 text-sm">{data.copy.audit.subject}<input class="h-10 rounded-md border bg-transparent px-3" name="subject" value={data.filters.subject ?? ""} /></label>
              <label class="grid gap-1 text-sm">{data.copy.audit.client}<input class="h-10 rounded-md border bg-transparent px-3" name="client" value={data.filters.client ?? ""} /></label>
              <label class="grid gap-1 text-sm">{data.copy.audit.targetType}<input class="h-10 rounded-md border bg-transparent px-3" name="targetType" value={data.filters.targetType ?? ""} /></label>
              <label class="grid gap-1 text-sm sm:col-span-2">{data.copy.audit.targetId}<input class="h-10 rounded-md border bg-transparent px-3" name="targetId" value={data.filters.targetId ?? ""} /></label>
            </div>
          </details>
          <div class="flex gap-2 sm:col-span-2 lg:col-span-4">
            <Button class="flex-1 sm:flex-none" type="submit">{data.copy.audit.apply}</Button>
            <Button class="flex-1 sm:flex-none" href="/admin/audit" variant="outline">{data.copy.audit.clear}</Button>
          </div>
        </form>
      </Card.Content>
    </Card.Root>
  {/snippet}

  <Card.Root>
    <Card.Header>
      <Card.Title>{data.copy.audit.records}</Card.Title>
      <Card.Description>{pageLabel()}</Card.Description>
    </Card.Header>
    <Card.Content class="p-0">
      {#if data.rows.length === 0}
        <p class="p-6 text-sm text-muted-foreground">{data.copy.audit.noRecords}</p>
      {:else}
        <Item.Group class="grid gap-3 p-4 md:hidden" role="list">
          {#each data.rows as row (row.id)}
            {@const actor = identity(row.user)}
            {@const subject = identity(row.subjectUser)}
            <Item.Root role="listitem" variant="outline" class="grid gap-3">
              <Item.Content class="min-w-0">
                <Item.Title>{auditActionLabel(data.locale, row.action)}</Item.Title>
                <Item.Description>{formatDate.format(new Date(row.createdAt))}</Item.Description>
              </Item.Content>
              <Item.Actions class="flex-wrap">
                <Badge variant={row.outcome === "success" ? "secondary" : "destructive"}>{auditOutcomeLabel(data.locale, row.outcome)}</Badge>
                <Badge variant="outline">{auditChannelLabel(data.locale, row.channel)}</Badge>
              </Item.Actions>
              <Item.Footer>
                <dl class="grid w-full gap-2 text-xs">
                  {#if actor}<div><dt class="text-muted-foreground">{data.copy.audit.actorColumn}</dt><dd>{actor.label} <span class="break-all font-mono text-muted-foreground">{actor.id}</span></dd></div>{/if}
                  {#if subject}<div><dt class="text-muted-foreground">{data.copy.audit.subjectColumn}</dt><dd>{subject.label} <span class="break-all font-mono text-muted-foreground">{subject.id}</span></dd></div>{/if}
                  {#if row.oauthClientId}<div><dt class="text-muted-foreground">{data.copy.audit.clientColumn}</dt><dd>{row.clientName ?? row.oauthClientId}</dd></div>{/if}
                  {#if row.targetType}<div><dt class="text-muted-foreground">{data.copy.audit.target}</dt><dd>{auditTargetLabel(data.locale, row.targetType)}{row.targetId ? ` · ${row.targetId}` : ""}</dd></div>{/if}
                  {#if row.metadata}
                    {#each Object.entries(row.metadata) as [key, value]}
                      <div><dt class="text-muted-foreground">{auditMetadataLabel(data.locale, key)}</dt><dd class="break-words">{displayValue(value)}</dd></div>
                    {/each}
                  {/if}
                </dl>
              </Item.Footer>
            </Item.Root>
          {/each}
        </Item.Group>

        <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
        <div class="hidden overflow-x-auto md:block" tabindex="0" role="region" aria-label={data.copy.audit.records}>
          <table class="w-full min-w-[980px] text-left text-sm">
            <thead class="border-b bg-muted/40"><tr><th class="p-3">{data.copy.audit.time}</th><th class="p-3">{data.copy.audit.action}</th><th class="p-3">{data.copy.audit.actorColumn}</th><th class="p-3">{data.copy.audit.subjectColumn}</th><th class="p-3">{data.copy.audit.clientColumn}</th><th class="p-3">{data.copy.audit.channel}</th><th class="p-3">{data.copy.audit.outcome}</th><th class="p-3">{data.copy.audit.target}</th><th class="p-3">{data.copy.audit.details}</th></tr></thead>
            <tbody>
              {#each data.rows as row (row.id)}
                {@const actor = identity(row.user)}
                {@const subject = identity(row.subjectUser)}
                <tr class="border-b align-top last:border-0">
                  <td class="whitespace-nowrap p-3">{formatDate.format(new Date(row.createdAt))}</td>
                  <td class="p-3">{auditActionLabel(data.locale, row.action)}</td>
                  <td class="p-3">{actor?.label ?? "—"}{#if actor}<span class="block max-w-44 truncate font-mono text-xs text-muted-foreground">{actor.id}</span>{/if}</td>
                  <td class="p-3">{subject?.label ?? "—"}{#if subject}<span class="block max-w-44 truncate font-mono text-xs text-muted-foreground">{subject.id}</span>{/if}</td>
                  <td class="p-3">{row.clientName ?? row.oauthClientId ?? "—"}</td>
                  <td class="p-3">{auditChannelLabel(data.locale, row.channel)}</td>
                  <td class="p-3"><Badge variant={row.outcome === "success" ? "secondary" : "destructive"}>{auditOutcomeLabel(data.locale, row.outcome)}</Badge></td>
                  <td class="p-3">{row.targetType ? auditTargetLabel(data.locale, row.targetType) : "—"}{row.targetId ? ` · ${row.targetId}` : ""}</td>
                  <td class="max-w-72 p-3 text-xs">{#if row.metadata}<dl class="grid gap-1">{#each Object.entries(row.metadata) as [key, value]}<div><dt class="inline text-muted-foreground">{auditMetadataLabel(data.locale, key)}: </dt><dd class="inline break-words">{displayValue(value)}</dd></div>{/each}</dl>{:else}—{/if}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </Card.Content>
    <Card.Footer class="flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-end">
      <span class="text-sm text-muted-foreground">{pageLabel()}</span>
      <div class="flex gap-2">
        {#if data.pagination.hasCursor}<Button class="flex-1" href="/admin/audit" variant="ghost">{data.copy.audit.newest}</Button>{/if}
        {#if data.pagination.nextCursor}<Button class="flex-1" href={nextHref(data.pagination.nextCursor)} variant="outline">{data.copy.audit.next}</Button>{/if}
      </div>
    </Card.Footer>
  </Card.Root>
</AdminWorkspace>
