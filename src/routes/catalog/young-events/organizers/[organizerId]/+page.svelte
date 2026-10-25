<script lang="ts">
import YoungOrganizerDetailPage from "@/features/young/components/YoungOrganizerDetailPage.svelte";
import { createEndlessList } from "@/lib/navigation/endless-list.svelte";
import { page } from "$app/state";
import type { PageData } from "./$types";

let { data }: { data: PageData } = $props();
const feed = createEndlessList({
  source: () => data,
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

{#if data.organizer}
  <YoungOrganizerDetailPage
    copy={data.copy}
    organizer={data.organizer}
    {events}
    endless={feed}
    source={data.source}
  />
{/if}
