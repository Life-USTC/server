<script lang="ts">
import AdminWorkspace from "@/features/admin/components/AdminWorkspace.svelte";
import PageHeader from "$lib/components/PageHeader.svelte";
import { Button } from "$lib/components/ui/button/index.js";
import * as Card from "$lib/components/ui/card/index.js";
import type { PageData } from "./$types";

export let data: PageData;

const formatDate = new Intl.DateTimeFormat(data.locale, {
  dateStyle: "medium",
  timeStyle: "short",
});

function identity(
  value: { id: string; name: string | null; username: string | null } | null,
) {
  if (!value) return "—";
  return `${value.name || value.username || value.id} (${value.id})`;
}

function nextHref(cursor: string) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(data.filters)) {
    if (value) query.set(key, String(value));
  }
  query.set("cursor", cursor);
  const search = query.toString();
  return search ? `/admin/audit?${search}` : "/admin/audit";
}

function pageLabel() {
  return data.copy.audit.page
    .replace("{shown}", String(data.rows.length))
    .replace("{total}", String(data.pagination.total));
}
</script>

<svelte:head><title>{data.copy.audit.title} - Life@USTC</title></svelte:head>

<AdminWorkspace>
  {#snippet header()}
    <PageHeader title={data.copy.audit.title} description={data.copy.audit.subtitle} eyebrow={data.copy.admin.title} />
  {/snippet}

  {#snippet controls()}
    <Card.Root>
      <Card.Header><Card.Title>{data.copy.audit.filters}</Card.Title></Card.Header>
      <Card.Content>
        <form method="GET" class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label class="grid gap-1 text-sm">{data.copy.audit.actor}<input class="h-9 rounded-md border bg-transparent px-3" name="actor" value={data.filters.actor ?? ""} /></label>
          <label class="grid gap-1 text-sm">{data.copy.audit.subject}<input class="h-9 rounded-md border bg-transparent px-3" name="subject" value={data.filters.subject ?? ""} /></label>
          <label class="grid gap-1 text-sm">{data.copy.audit.client}<input class="h-9 rounded-md border bg-transparent px-3" name="client" value={data.filters.client ?? ""} /></label>
          <label class="grid gap-1 text-sm">{data.copy.audit.action}<select class="h-9 rounded-md border bg-background px-3" name="action"><option value="">{data.copy.audit.all}</option>{#each data.actions as action}<option value={action} selected={data.filters.action === action}>{action}</option>{/each}</select></label>
          <label class="grid gap-1 text-sm">{data.copy.audit.outcome}<select class="h-9 rounded-md border bg-background px-3" name="outcome"><option value="">{data.copy.audit.all}</option>{#each data.outcomes as outcome}<option value={outcome} selected={data.filters.outcome === outcome}>{outcome}</option>{/each}</select></label>
          <label class="grid gap-1 text-sm">{data.copy.audit.channel}<select class="h-9 rounded-md border bg-background px-3" name="channel"><option value="">{data.copy.audit.all}</option>{#each data.channels as channel}<option value={channel} selected={data.filters.channel === channel}>{channel}</option>{/each}</select></label>
          <label class="grid gap-1 text-sm">{data.copy.audit.targetType}<input class="h-9 rounded-md border bg-transparent px-3" name="targetType" value={data.filters.targetType ?? ""} /></label>
          <label class="grid gap-1 text-sm">{data.copy.audit.targetId}<input class="h-9 rounded-md border bg-transparent px-3" name="targetId" value={data.filters.targetId ?? ""} /></label>
          <label class="grid gap-1 text-sm">{data.copy.audit.from}<input class="h-9 rounded-md border bg-transparent px-3" type="date" name="from" value={data.filters.from ?? ""} /></label>
          <label class="grid gap-1 text-sm">{data.copy.audit.to}<input class="h-9 rounded-md border bg-transparent px-3" type="date" name="to" value={data.filters.to ?? ""} /></label>
          <div class="flex items-end gap-2 sm:col-span-2">
            <Button type="submit">{data.copy.audit.apply}</Button>
            <Button href="/admin/audit" variant="outline">{data.copy.audit.clear}</Button>
          </div>
        </form>
      </Card.Content>
    </Card.Root>
  {/snippet}

  <Card.Root>
    <Card.Header><Card.Title>{data.copy.audit.records}</Card.Title><Card.Description>{pageLabel()}</Card.Description></Card.Header>
    <Card.Content class="p-0">
      {#if data.rows.length === 0}
        <p class="p-6 text-sm text-muted-foreground">{data.copy.audit.noRecords}</p>
      {:else}
        <div class="overflow-x-auto">
          <table class="w-full min-w-[1050px] text-left text-sm">
            <thead class="border-b bg-muted/40"><tr><th class="p-3">{data.copy.audit.time}</th><th class="p-3">{data.copy.audit.action}</th><th class="p-3">{data.copy.audit.actorColumn}</th><th class="p-3">{data.copy.audit.subjectColumn}</th><th class="p-3">{data.copy.audit.clientColumn}</th><th class="p-3">{data.copy.audit.channel}</th><th class="p-3">{data.copy.audit.outcome}</th><th class="p-3">{data.copy.audit.target}</th><th class="p-3">{data.copy.audit.details}</th></tr></thead>
            <tbody>
              {#each data.rows as row (row.id)}
                <tr class="border-b align-top last:border-0">
                  <td class="whitespace-nowrap p-3">{formatDate.format(new Date(row.createdAt))}</td>
                  <td class="p-3 font-mono text-xs">{row.action}</td>
                  <td class="p-3">{identity(row.user)}</td>
                  <td class="p-3">{identity(row.subjectUser)}</td>
                  <td class="p-3">{row.clientName ?? row.oauthClientId ?? "—"}</td>
                  <td class="p-3">{row.channel}</td>
                  <td class="p-3">{row.outcome}</td>
                  <td class="p-3 font-mono text-xs">{row.targetType ?? "—"}{row.targetId ? ` / ${row.targetId}` : ""}</td>
                  <td class="max-w-72 p-3 font-mono text-xs">{row.metadata ? JSON.stringify(row.metadata) : "—"}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </Card.Content>
    <Card.Footer class="justify-end gap-3">
      <span class="text-sm text-muted-foreground">{pageLabel()}</span>
      {#if data.pagination.nextCursor}<Button href={nextHref(data.pagination.nextCursor)} variant="outline">{data.copy.audit.next}</Button>{/if}
    </Card.Footer>
  </Card.Root>
</AdminWorkspace>
