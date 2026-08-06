<script lang="ts">
import AdminBusPageController from "@/features/admin/components/AdminBusPageController.svelte";
import type { PageData } from "./$types";

export let data: PageData;
</script>

<AdminBusPageController {data} />
