<script lang="ts">
import { toast } from "svelte-sonner";
import CollectionPage from "#lib/components/CollectionPage.svelte";
import EndlessScroll from "#lib/components/EndlessScroll.svelte";
import FilterToolbar from "#lib/components/FilterToolbar.svelte";
import ResultsEmpty from "#lib/components/ResultsEmpty.svelte";
import ResultsSummary from "#lib/components/ResultsSummary.svelte";
import { toolbarControlClass } from "#lib/components/toolbar-control.js";
import { Badge } from "#lib/components/ui/badge/index.js";
import { Button } from "#lib/components/ui/button/index.js";
import * as Item from "#lib/components/ui/item/index.js";
import * as ToggleGroup from "#lib/components/ui/toggle-group/index.js";
import YoungSubscriptionControl from "@/features/young/components/YoungSubscriptionControl.svelte";
import { youngDateTime } from "@/features/young/lib/young-event-display";
import { youngNotificationDescription } from "@/features/young/lib/young-notification-display";
import { youngNotificationReadSchema } from "@/lib/api/schemas/young-workspace-schemas";
import type { EndlessScrollState } from "@/lib/navigation/endless-list.svelte";
import { goto, invalidateAll } from "$app/navigation";
import { page } from "$app/state";
import type { PageData } from "../../../routes/workspace/subscriptions/activities/$types";

let { data, endless }: { data: PageData; endless: EndlessScrollState } =
  $props();
const copy = $derived(data.copy.youngEvents.workspace);
const result = $derived(data.events ?? data.organizers ?? data.notifications);
/**
 * All three `?view=` states share this route, so the heading has to name the
 * view the sidebar sent the reader to rather than the route as a whole.
 */
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
  const query = new URLSearchParams(page.url.search);
  query.set("view", "notifications");
  query.delete("page");

  if (value === "unread") query.set("unread", "true");
  else query.delete("unread");

  void goto(`${page.url.pathname}?${query}`, { reset: false });
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
    const result = youngNotificationReadSchema.parse(await response.json());
    if (result.id !== id || result.success !== true) throw new Error();
    await invalidateAll();
  } catch {
    toast.error(copy.failed);
  } finally {
    reading = null;
  }
}
</script>

<svelte:head><title>{viewLabel} - Life@USTC</title></svelte:head>

{#snippet paginationFooter()}
  <EndlessScroll state={endless} labels={data.copy.common.endlessScroll} />
{/snippet}

{#snippet filtersHeader()}
  <FilterToolbar>
    {#snippet primary()}
      {#if data.notifications}
        <ToggleGroup.Root
          type="single"
          variant="outline"
          bind:value={() => (data.unread ? "unread" : "all"), filterNotifications}
          aria-label={copy.notificationFilter}
        >
          <ToggleGroup.Item value="all" class={toolbarControlClass}>{copy.allNotifications}</ToggleGroup.Item>
          <ToggleGroup.Item value="unread" class={toolbarControlClass}>{copy.unreadNotifications}</ToggleGroup.Item>
        </ToggleGroup.Root>
      {:else if data.events}
        <p class="text-muted-foreground text-sm">{copy.eventSubscriptionsHint}</p>
      {/if}
    {/snippet}
  </FilterToolbar>
{/snippet}

<CollectionPage
  description={description}
  footer={endless.hasMore ? paginationFooter : undefined}
  title={viewLabel}
  toolbar={data.events || data.notifications ? filtersHeader : undefined}
>
  {#snippet actions()}
        <Button href="/workspace/subscriptions" variant="ghost" size="sm">{copy.back}</Button>
        <Button href="/workspace/calendar" variant="outline" size="sm">{copy.calendar}</Button>
  {/snippet}

  <div class="grid gap-3">
      <ResultsSummary summary={`${viewLabel} · ${result?.pagination.total ?? 0}`} />
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
                <a
                  class="font-medium [overflow-wrap:anywhere]"
                  href={`/catalog/young-events/organizers/${encodeURIComponent(row.organizerId)}`}
                >{row.organizer.name}</a>

                <YoungSubscriptionControl
                  id={row.organizerId}
                  kind="organizers"
                  copy={copy}
                  initialState={{ subscribed: true }}
                />
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
      <ResultsEmpty
        title={data.notifications
          ? data.unread ? copy.noUnread : copy.noNotifications
          : copy.empty}
        description={description}
      >
        {#if data.notifications && data.unread}
          <Button href="?view=notifications" variant="outline">{copy.allNotifications}</Button>
        {:else}
          <Button href={data.organizers ? "/catalog/young-events/organizers" : "/catalog/young-events"} variant="outline">{data.organizers ? copy.browseOrganizers : copy.browseActivities}</Button>
        {/if}
      </ResultsEmpty>
    {/if}
    </div>
</CollectionPage>
