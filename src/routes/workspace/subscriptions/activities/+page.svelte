<script lang="ts">
import { toast } from "svelte-sonner";
import CatalogPagination from "@/features/catalog/components/CatalogPagination.svelte";
import YoungSubscriptionControl from "@/features/young/components/YoungSubscriptionControl.svelte";
import { invalidateAll } from "$app/navigation";
import { page } from "$app/stores";
import PageLayout from "$lib/components/PageLayout.svelte";
import Panel from "$lib/components/Panel.svelte";
import { Badge } from "$lib/components/ui/badge";
import { Button } from "$lib/components/ui/button";
import * as Empty from "$lib/components/ui/empty";
import type { PageData } from "./$types";

let { data }: { data: PageData } = $props();
const copy = $derived(data.copy.youngEvents.workspace);
const result = $derived(data.events ?? data.organizers ?? data.notifications);
let reading = $state<string | null>(null);
async function markRead(id: string) {
  reading = id;
  try {
    const response = await fetch(
      `/api/workspace/young-notifications/${encodeURIComponent(id)}/read`,
      { method: "POST" },
    );
    if (!response.ok) throw new Error();
    await invalidateAll();
  } catch {
    toast.error(copy.failed);
  } finally {
    reading = null;
  }
}
function pageHref(number: number) {
  const query = new URLSearchParams($page.url.searchParams);
  query.set("page", String(number));
  return `${$page.url.pathname}?${query}`;
}
</script>

<PageLayout title={copy.manage} description={copy.hint}>
  <div class="grid gap-5">
    <nav class="flex flex-wrap gap-2" aria-label={copy.manage}>
      <Button href="?view=events" variant={data.events ? "default" : "outline"}>{copy.events}</Button>
      <Button href="?view=organizers" variant={data.organizers ? "default" : "outline"}>{copy.organizers}</Button>
      <Button href="?view=notifications" variant={data.notifications ? "default" : "outline"}>{copy.notifications}</Button>
      <Button href="/workspace/calendar" variant="link">{copy.calendar}</Button>
      <Button href="/workspace/subscriptions" variant="link">{copy.back}</Button>
    </nav>
    {#if data.events}
      {#each data.events.data as row (row.youngId)}
        <Panel>
          <div class="grid gap-3">
            <a class="font-medium" href={`/catalog/young-events/${encodeURIComponent(row.youngId)}`}>{row.event.name}</a>
            <p>{row.event.startAt?.slice(0, 16).replace("T", " ") ?? copy.unknown}{row.event.location ? ` · ${row.event.location}` : ""}</p>
            <YoungSubscriptionControl id={row.youngId} copy={copy} initialState={{ ...row, subscribed: true }} />
          </div>
        </Panel>
      {/each}
    {:else if data.organizers}
      {#each data.organizers.data as row (row.organizerId)}
        <Panel>
          <div class="grid gap-3">
            <a class="font-medium" href={`/catalog/young-events/organizers/${encodeURIComponent(row.organizerId)}`}>{row.organizer.name}</a>
            <YoungSubscriptionControl id={row.organizerId} kind="organizers" {copy} initialState={{ subscribed: true }} />
          </div>
        </Panel>
      {/each}
    {:else if data.notifications}
      {#each data.notifications.data as row (row.id)}
        <Panel>
          <div class="grid gap-3">
            <div class="flex flex-wrap items-center gap-3">
              <a class="font-medium" href={row.youngId ? `/catalog/young-events/${encodeURIComponent(row.youngId)}` : `/catalog/young-events/organizers/${encodeURIComponent(row.organizerId ?? "")}`}>{row.title}</a>
              {#if !row.readAt}<Badge variant="secondary">{copy.unread}</Badge>{/if}
            </div>
            <p>{row.body}</p>
            {#if !row.readAt}<Button class="justify-self-start" variant="outline" disabled={reading === row.id} onclick={() => markRead(row.id)}>{copy.read}</Button>{/if}
          </div>
        </Panel>
      {/each}
    {/if}
    {#if !result?.data.length}
      <Empty.Root><Empty.Header><Empty.Title>{copy.empty}</Empty.Title></Empty.Header><Empty.Content><Button href="/catalog/young-events">{data.copy.youngEvents.backToList}</Button></Empty.Content></Empty.Root>
    {/if}
    {#if result && result.pagination.totalPages > 1}
      <CatalogPagination ariaLabel={data.copy.common.pagination} nextLabel={data.copy.common.next} nextPageLabel={data.copy.common.nextPage} previousLabel={data.copy.common.previous} previousPageLabel={data.copy.common.previousPage} page={result.pagination.page} totalPages={result.pagination.totalPages} {pageHref} />
    {/if}
  </div>
</PageLayout>
