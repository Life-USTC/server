<script lang="ts">
import AdminBusPageController from "@/features/admin/components/AdminBusPageController.svelte";
import type { ActionData, PageData } from "./$types";

export let data: PageData;
export let form: ActionData;
</script>

<AdminBusPageController {data} {form} />
