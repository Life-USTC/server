<script lang="ts">
import PublicationListPage from "@/features/publications/components/PublicationListPage.svelte";
import { publicationListHref } from "@/features/publications/lib/publication-page-navigation";
import { createEndlessList } from "@/lib/navigation/endless-list.svelte";
import type { PageData } from "./$types";

let { data }: { data: PageData } = $props();
const feed = createEndlessList({
  source: () => data,
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

<PublicationListPage data={listData} copy={data.copy} endless={feed} />
