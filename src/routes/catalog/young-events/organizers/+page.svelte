<script lang="ts">
import YoungOrganizersPage from "@/features/young/components/YoungOrganizersPage.svelte";
import type { PageData } from "./$types";

let { data }: { data: PageData } = $props();
</script>

<svelte:head>
  <title>{data.copy.youngEvents.organizersTitle} - Life@USTC</title>
</svelte:head>

<YoungOrganizersPage
  copy={data.copy}
  data={data.data}
  pagination={data.pagination}
  search={data.search}
  source={data.source}
/>
