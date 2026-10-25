<script lang="ts">
import YoungEventsPage from "@/features/young/components/YoungEventsPage.svelte";
import { createEndlessList } from "@/lib/navigation/endless-list.svelte";
import { page } from "$app/state";
import type { PageData } from "./$types";

let { data }: { data: PageData } = $props();
const feed = createEndlessList({
  source: () => data,
  select: (value) => ({ items: value.data, ...value.pagination }),
  key: (row) => row.youngId,
  pageHref: (next) => {
    const query = new URLSearchParams(page.url.search);
    query.set("page", String(next));
    return `${page.url.pathname}?${query}`;
  },
});
</script>

<svelte:head>
  <title>{data.copy.youngEvents.title} - Life@USTC</title>
</svelte:head>

<YoungEventsPage
  categories={data.categories}
  copy={data.copy}
  data={feed.items}
  endless={feed}
  tableFilters={data.tableFilters}
  organizers={data.organizers}
  source={data.source}
/>
