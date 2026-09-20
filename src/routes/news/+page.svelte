<script lang="ts">
import PublicationListPage from "@/features/publications/components/PublicationListPage.svelte";
import type { PageData } from "./$types";

let { data }: { data: PageData } = $props();
</script>

<PublicationListPage data={data} copy={data.copy} />
