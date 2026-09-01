<script lang="ts">
import PublicationListPage from "@/features/publications/components/PublicationListPage.svelte";
import type { PageData } from "./$types";

export let data: PageData;
</script>

<PublicationListPage data={data} copy={data.copy} />
