<script lang="ts">
import DemoNotice from "@/features/demo/components/DemoNotice.svelte";
import { homePublicReadEpoch } from "@/features/demo/lib/demo-home-owner";
import YoungOrganizerDetailPage from "@/features/young/components/YoungOrganizerDetailPage.svelte";
import { createEndlessList } from "@/lib/navigation/endless-list.svelte";
import { getShellViewer } from "@/lib/shell/shell-viewer";
import { browser } from "$app/env";
import { page } from "$app/state";
import type { PageData } from "./$types";

let { data }: { data: PageData } = $props();
const shellViewer = getShellViewer();
const demo = $derived("youngSampleNotice" in data ? data.demo : null);
const readEpoch = $derived(homePublicReadEpoch($shellViewer, demo));
const readable = $derived(!browser || Boolean(readEpoch));
const restricted = $derived(Boolean(demo || $shellViewer.demo));
const feed = createEndlessList({
  source: () => {
    void readEpoch;
    return data;
  },
  select: (value) => ({ items: value.events.data, ...value.events.pagination }),
  key: (row) => row.youngId,
  pageHref: (next) => {
    const query = new URLSearchParams(page.url.search);
    query.set("page", String(next));
    return `${page.url.pathname}?${query}`;
  },
});
const events = $derived({ ...data.events, data: feed.items });
</script>

<svelte:head>
  <title>{data.organizer?.name ?? data.copy.youngEvents.organizerNotFound} - Life@USTC</title>
</svelte:head>
{#if demo}<DemoNotice {demo} locale={data.locale} /><p class="mb-4 text-sm" data-testid="demo-young-fictional">{"youngSampleNotice" in data ? data.youngSampleNotice : ""}</p>{/if}
{#if readable}


{#if data.organizer}{#key `${readEpoch}:${demo ? data.locale : ""}`}
  <YoungOrganizerDetailPage readOnly={restricted} readOnlyReason={demo?.readOnlyReason ?? ""} readOnlyLabel={"youngSubscriptionFactsLabel" in data ? data.youngSubscriptionFactsLabel : ""} subscriptionState={"subscriptionState" in data ? data.subscriptionState ?? undefined : undefined}
    copy={data.copy}
    organizer={data.organizer}
    {events}
    endless={feed}
    source={data.source}
  />
{/key}{/if}

{/if}
