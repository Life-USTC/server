<script lang="ts">
import AdminDashboardPage from "@/features/admin/components/AdminDashboardPage.svelte";
import type { PageData } from "./$types";

export let data: PageData;
</script>

<AdminDashboardPage {data} />
