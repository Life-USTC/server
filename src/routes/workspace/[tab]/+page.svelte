<script lang="ts">
import DashboardPage from "../+page.svelte";
import type { ActionData, PageData } from "./$types";

export let data: PageData;
export let form: ActionData | undefined = undefined;
</script>

<DashboardPage {data} {form} />
