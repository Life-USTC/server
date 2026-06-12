<script lang="ts">
import AdminOAuthPageController from "@/features/admin/components/AdminOAuthPageController.svelte";
import type { ActionData, PageData } from "./$types";

export let data: PageData;
export let form: ActionData;
</script>

<AdminOAuthPageController {data} {form} />
