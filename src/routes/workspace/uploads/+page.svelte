<script lang="ts">
import UploadsPage from "@/features/uploads/components/UploadsPage.svelte";
import type { PageData } from "./$types";

let { data }: { data: PageData } = $props();
</script>
<UploadsPage {data} />
