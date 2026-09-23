<script lang="ts">
import WelcomePageController from "@/features/welcome/components/WelcomePageController.svelte";
import type { ActionData, PageData } from "./$types";

export let data: PageData;
export let form: ActionData;
</script>

<WelcomePageController {data} {form} />
