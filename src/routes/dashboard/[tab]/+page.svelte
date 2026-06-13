<script lang="ts">
import DashboardPageController from "@/features/dashboard/components/DashboardPageController.svelte";
import type { DashboardActionData } from "@/features/dashboard/lib/dashboard-controller-helpers";
import type { PageData } from "./$types";

export let data: PageData;
export let form: DashboardActionData = undefined;
</script>

<DashboardPageController {data} {form} />
