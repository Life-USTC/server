<script lang="ts">
import YoungOrganizersPage from "@/features/young/components/YoungOrganizersPage.svelte";
import { createEndlessList } from "@/lib/navigation/endless-list.svelte";
import { page } from "$app/state";
import type { PageData } from "./$types";

let { data }: { data: PageData } = $props();
const feed = createEndlessList({
  source: () => data,
  select: (value) => ({ items: value.data, ...value.pagination }),
  key: (row) => row.id,
  pageHref: (next) => {
    const query = new URLSearchParams(page.url.search);
    query.set("page", String(next));
    return `${page.url.pathname}?${query}`;
  },
});
</script>

<svelte:head>
  <title>{data.copy.youngEvents.organizersTitle} - Life@USTC</title>
</svelte:head>

<YoungOrganizersPage
  copy={data.copy}
  data={feed.items}
  endless={feed}
  tableFilters={data.tableFilters}
  source={data.source}
/>
