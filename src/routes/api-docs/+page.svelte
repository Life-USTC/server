<script lang="ts">
import ApiDocsPage from "@/features/api-docs/components/ApiDocsPage.svelte";
import type { PageData } from "./$types";

export let data: PageData;
</script>

<ApiDocsPage {data} />
