<script lang="ts">
import UploadsPage from "@/features/uploads/components/UploadsPage.svelte";
import { createEndlessList } from "@/lib/navigation/endless-list.svelte";
import { tableFilterPageHref } from "@/lib/table-filter-query";
import type { PageData } from "./$types";

let { data }: { data: PageData } = $props();
const feed = createEndlessList({
  source: () => data,
  select: (value) => ({
    items: value.uploads,
    page: value.page,
    totalPages: value.totalPages,
  }),
  key: (row) => row.id,
  pageHref: (next) =>
    tableFilterPageHref("/workspace/uploads", data.filters, next),
});
const listData = $derived({ ...data, uploads: feed.items });
</script>
<UploadsPage data={listData} endless={feed} />
