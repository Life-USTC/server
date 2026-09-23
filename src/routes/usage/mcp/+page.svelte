<script lang="ts">
import McpUsagePage from "@/features/usage/components/McpUsagePage.svelte";
import type { PageData } from "./$types";

export let data: PageData;
</script>

<McpUsagePage {data} />
