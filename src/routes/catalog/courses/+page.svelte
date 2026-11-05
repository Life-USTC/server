<script lang="ts">
import CoursesPageController from "@/features/catalog/components/CoursesPageController.svelte";
import { catalogListPageHref } from "@/features/catalog/lib/catalog-list-query";
import DemoNotice from "@/features/demo/components/DemoNotice.svelte";
import { createEndlessList } from "@/lib/navigation/endless-list.svelte";
import { page } from "$app/state";
import type { PageData } from "./$types";

let { data }: { data: PageData } = $props();
const endless = createEndlessList({
  source: () => data,
  select: (value) => ({ items: value.data, ...value.pagination }),
  key: (row) => row.jwId,
  pageHref: (next) => catalogListPageHref(new URL(page.url.href), next),
});
</script>

{#if data.demo}
  <DemoNotice demo={data.demo} locale={data.locale} />
{/if}
<CoursesPageController data={{ ...data, data: endless.items }} {endless} />
