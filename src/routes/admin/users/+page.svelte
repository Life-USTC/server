<script lang="ts">
import AdminUsersPageController from "@/features/admin/components/AdminUsersPageController.svelte";
import type { PageData } from "./$types";

export let data: PageData;
</script>

<AdminUsersPageController {data} />
