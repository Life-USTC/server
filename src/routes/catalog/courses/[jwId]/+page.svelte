<script lang="ts">
import type { PageData } from "./$types";
import Introduction from "./introduction/+page.svelte";

let { data }: { data: PageData } = $props();
</script>

<Introduction {data} />
