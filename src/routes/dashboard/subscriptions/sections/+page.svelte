<script lang="ts">
import DashboardPage from "../../../+page.svelte";
import type { PageData } from "../../../$types";

export let data: PageData;
</script>

<DashboardPage {data} />
