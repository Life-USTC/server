<script lang="ts">
import type { PageData } from "../../$types";
import DashboardPage from "../+page.svelte";

export let data: PageData;
</script>

<DashboardPage {data} />
