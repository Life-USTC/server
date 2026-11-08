<script lang="ts">
import DemoNotice from "@/features/demo/components/DemoNotice.svelte";
import { homePublicReadEpoch } from "@/features/demo/lib/demo-home-owner";
import PublicationListPage from "@/features/publications/components/PublicationListPage.svelte";
import { publicationListHref } from "@/features/publications/lib/publication-page-navigation";
import { createEndlessList } from "@/lib/navigation/endless-list.svelte";
import { getShellViewer } from "@/lib/shell/shell-viewer";
import { browser } from "$app/env";
import type { PageData } from "./$types";

let { data }: { data: PageData } = $props();
const shellViewer = getShellViewer();
const readEpoch = $derived(homePublicReadEpoch($shellViewer, data.demo));
const readable = $derived(!browser || Boolean(readEpoch));
const feed = createEndlessList({
  source: () => {
    void readEpoch;
    return data;
  },
  select: (value) => ({
    items: value.publications.data,
    ...value.publications.pagination,
  }),
  key: (row) => row.id,
  pageHref: (next) => publicationListHref(data.filters, next),
});
const listData = $derived({
  ...data,
  publications: { ...data.publications, data: feed.items },
});
</script>

{#if data.demo}<DemoNotice demo={data.demo} locale={data.locale} /><p class="mb-4 text-sm" data-testid="demo-news-fictional">{data.newsSampleNotice}</p>{/if}
{#if readable}<PublicationListPage data={listData} copy={data.copy} endless={feed} />{/if}
