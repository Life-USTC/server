<script lang="ts">
import DashboardPageController from "@/features/dashboard/components/DashboardPageController.svelte";
import type { ActionData, PageData } from "./$types";

export let data: PageData;
export let form: ActionData | undefined = undefined;
</script>

<DashboardPageController {data} {form} />
