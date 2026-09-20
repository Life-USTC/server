<script lang="ts">
import PublicationSourceDirectoryPage from "@/features/publications/components/PublicationSourceDirectoryPage.svelte";
import type { PageData } from "./$types";

let { data }: { data: PageData } = $props();
</script>

<PublicationSourceDirectoryPage data={data} copy={data.copy} />
