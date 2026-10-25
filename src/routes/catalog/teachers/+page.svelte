<script lang="ts">
import TeachersPageController from "@/features/catalog/components/TeachersPageController.svelte";
import { catalogListPageHref } from "@/features/catalog/lib/catalog-list-query";
import { createEndlessList } from "@/lib/navigation/endless-list.svelte";
import { page } from "$app/state";
import type { PageData } from "./$types";

let { data }: { data: PageData } = $props();
const endless = createEndlessList({
  source: () => data,
  select: (value) => ({ items: value.data, ...value.pagination }),
  key: (row) => row.id,
  pageHref: (next) => catalogListPageHref(new URL(page.url.href), next),
});
</script>

<TeachersPageController data={{ ...data, data: endless.items }} {endless} />
