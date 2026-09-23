<script lang="ts">
import SettingsPageController from "@/features/settings/components/SettingsPageController.svelte";
import type { ActionData, PageData } from "./$types";

export let data: PageData;
export let form: ActionData;
</script>

<SettingsPageController {data} {form} />
