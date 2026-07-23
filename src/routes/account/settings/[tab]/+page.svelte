<script lang="ts">
import SettingsPage from "../+page.svelte";
import type { ActionData, PageData } from "../$types";

export let data: PageData;
export let form: ActionData;
</script>

<SettingsPage {data} {form} />
