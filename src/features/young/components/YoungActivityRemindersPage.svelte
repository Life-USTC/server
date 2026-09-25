<script lang="ts">
import { toast } from "svelte-sonner";
import YoungSubscriptionControl from "@/features/young/components/YoungSubscriptionControl.svelte";
import { youngDateTime } from "@/features/young/lib/young-event-display";
import { youngNotificationDescription } from "@/features/young/lib/young-notification-display";
import { goto, invalidateAll } from "$app/navigation";
import { page } from "$app/stores";
import ListPagination from "$lib/components/ListPagination.svelte";
import PageHeader from "$lib/components/PageHeader.svelte";
import PageLayout from "$lib/components/PageLayout.svelte";
import PageSectionNav from "$lib/components/PageSectionNav.svelte";
import Panel from "$lib/components/Panel.svelte";
import ResultsEmpty from "$lib/components/ResultsEmpty.svelte";
import ResultsSummary from "$lib/components/ResultsSummary.svelte";
import { Badge } from "$lib/components/ui/badge";
import { Button } from "$lib/components/ui/button";
import * as Item from "$lib/components/ui/item";
import * as ToggleGroup from "$lib/components/ui/toggle-group";
import type { PageData } from "../../../routes/workspace/subscriptions/activities/$types";

let { data }: { data: PageData } = $props();
const copy = $derived(data.copy.youngEvents.workspace);
const result = $derived(data.events ?? data.organizers ?? data.notifications);
const viewLabel = $derived(
  data.events
    ? copy.events
    : data.organizers
      ? copy.organizers
      : copy.notifications,
);
const description = $derived(
  data.notifications
    ? copy.notificationsHint
    : data.organizers
      ? copy.organizerSubscriptionsHint
      : copy.hint,
);
function notificationKind(kind: string) {
  return (
    copy.notificationKinds[kind as keyof typeof copy.notificationKinds] ??
    copy.notifications
  );
}
function filterNotifications(value: string) {
  if (!value) return;
  const query = new URLSearchParams($page.url.searchParams);
  query.set("view", "notifications");
  query.delete("page");
  if (value === "unread") query.set("unread", "true");
  else query.delete("unread");
  void goto(`${$page.url.pathname}?${query}`, {
    keepFocus: true,
    noScroll: true,
  });
}
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

{#snippet paginationFooter()}
  {#if result}<ListPagination ariaLabel={data.copy.common.pagination} nextLabel={data.copy.common.next} nextPageLabel={data.copy.common.nextPage} previousLabel={data.copy.common.previous} previousPageLabel={data.copy.common.previousPage} page={result.pagination.page} totalPages={result.pagination.totalPages} {pageHref} />{/if}
{/snippet}

    {#snippet filtersHeader()}

    {#if data.notifications}
      <ToggleGroup.Root type="single" variant="outline" bind:value={() => data.unread ? "unread" : "all", filterNotifications} aria-label={copy.notificationFilter}>
        <ToggleGroup.Item value="all">{copy.allNotifications}</ToggleGroup.Item>
        <ToggleGroup.Item value="unread">{copy.unreadNotifications}</ToggleGroup.Item>
      </ToggleGroup.Root>
    {:else if data.events}
      <p class="text-muted-foreground text-sm">{copy.eventSubscriptionsHint}</p>
    {/if}
    {/snippet}

<PageLayout>
  {#snippet header()}
    <PageHeader title={copy.manage} {description}>
      {#snippet actions()}
        <Button href="/workspace/subscriptions" variant="ghost" size="sm">{copy.back}</Button>
        <Button href="/workspace/calendar" variant="outline" size="sm">{copy.calendar}</Button>
      {/snippet}
    </PageHeader>
  {/snippet}
  <PageSectionNav ariaLabel={copy.manage} items={[
    { href: "?view=events", label: copy.events, current: Boolean(data.events) },
    { href: "?view=organizers", label: copy.organizers, current: Boolean(data.organizers) },
    { href: "?view=notifications", label: copy.notifications, current: Boolean(data.notifications) },
  ]} />
  <Panel header={data.events || data.notifications ? filtersHeader : undefined} footer={result && result.pagination.totalPages > 1 ? paginationFooter : undefined}>

    <div class="grid gap-3">
      <ResultsSummary summary={`${viewLabel} · ${result?.pagination.total ?? 0}`} page={result?.pagination.page} totalPages={result?.pagination.totalPages} />
      <Item.Group class="gap-3">
    {#if data.events}
      {#each data.events.data as row (row.youngId)}
        <Item.Root variant="outline">
          <Item.Content>
          <div class="grid gap-3">
            <a class="font-medium [overflow-wrap:anywhere]" href={`/catalog/young-events/${encodeURIComponent(row.youngId)}`}>{row.event.name}</a>
            <p>{youngDateTime(row.event.startAt) ?? copy.unknown}{row.event.location ? ` · ${row.event.location}` : ""}</p>
            <YoungSubscriptionControl id={row.youngId} copy={copy} initialState={{ ...row, subscribed: true }} />
          </div>
          </Item.Content>
        </Item.Root>
      {/each}
    {:else if data.organizers}
      {#each data.organizers.data as row (row.organizerId)}
        <Item.Root variant="outline">
          <Item.Content>
          <div class="grid gap-3">
            <a class="font-medium [overflow-wrap:anywhere]" href={`/catalog/young-events/organizers/${encodeURIComponent(row.organizerId)}`}>{row.organizer.name}</a>
            <YoungSubscriptionControl id={row.organizerId} kind="organizers" {copy} initialState={{ subscribed: true }} />
          </div>
          </Item.Content>
        </Item.Root>
      {/each}
    {:else if data.notifications}
      {#each data.notifications.data as row (row.id)}
        <Item.Root variant="outline">
          <Item.Content>
          <div class="grid gap-3">
            <div class="flex flex-wrap items-center gap-3">
              <a class="font-medium [overflow-wrap:anywhere]" href={row.youngId ? `/catalog/young-events/${encodeURIComponent(row.youngId)}` : `/catalog/young-events/organizers/${encodeURIComponent(row.organizerId ?? "")}`}>{row.title}</a>
              {#if !row.readAt}<Badge variant="secondary">{copy.unread}</Badge>{/if}
            </div>
            <div class="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{notificationKind(row.kind)}</Badge>
              <time class="text-muted-foreground text-sm" datetime={row.createdAt}>{youngDateTime(row.createdAt)}</time>
            </div>
            <p class="text-sm [overflow-wrap:anywhere]">{youngNotificationDescription(row, copy)}</p>
            <div class="flex flex-wrap gap-2">
              {#if !row.readAt}<Button variant="outline" size="sm" disabled={reading !== null} onclick={() => markRead(row.id)}>{copy.read}</Button>{/if}
              {#if row.youngId}
                <Button variant="ghost" size="sm" href={`/catalog/young-events/${encodeURIComponent(row.youngId)}`}>{copy.viewActivity}</Button>
              {:else if row.organizerId}
                <Button variant="ghost" size="sm" href={`/catalog/young-events/organizers/${encodeURIComponent(row.organizerId)}`}>{copy.viewOrganizer}</Button>
              {/if}
            </div>
          </div>
          </Item.Content>
        </Item.Root>
      {/each}
    {/if}
      </Item.Group>
    {#if !result?.data.length}
      <ResultsEmpty title={data.notifications ? (data.unread ? copy.noUnread : copy.noNotifications) : copy.empty} {description}>
        {#if data.notifications && data.unread}
          <Button href="?view=notifications" variant="outline">{copy.allNotifications}</Button>
        {:else}
          <Button href={data.organizers ? "/catalog/young-events/organizers" : "/catalog/young-events"} variant="outline">{data.organizers ? copy.browseOrganizers : copy.browseActivities}</Button>
        {/if}
      </ResultsEmpty>
    {/if}
    </div>
  </Panel>
</PageLayout>
