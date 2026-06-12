<script lang="ts">
import AdminModerationPageController from "@/features/admin/components/AdminModerationPageController.svelte";
import type { ActionData, PageData } from "./$types";

export let data: PageData;
export let form: ActionData;
</script>

<AdminModerationPageController {data} {form} />
