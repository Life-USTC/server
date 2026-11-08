<script lang="ts">
import DemoNotice from "@/features/demo/components/DemoNotice.svelte";
import { homePublicReadEpoch } from "@/features/demo/lib/demo-home-owner";
import YoungOrganizersPage from "@/features/young/components/YoungOrganizersPage.svelte";
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

const feed = createEndlessList({
  source: () => {
    void readEpoch;
    return data;
  },
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
{#if demo}<DemoNotice {demo} locale={data.locale} /><p class="mb-4 text-sm" data-testid="demo-young-fictional">{"youngSampleNotice" in data ? data.youngSampleNotice : ""}</p>{/if}
{#if readable}


<YoungOrganizersPage
  copy={data.copy}
  data={feed.items}
  endless={feed}
  tableFilters={data.tableFilters}
  source={data.source}
/>

{/if}
