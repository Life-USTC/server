<script lang="ts">
import PublicationDetailPage from "@/features/publications/components/PublicationDetailPage.svelte";
import type { PageData } from "./$types";

export let data: PageData;
</script>

<PublicationDetailPage data={data} copy={data.copy} />
