<script lang="ts">
import WorkspacePage from "../+page.svelte";
import type { ActionData, PageData } from "./$types";

export let data: PageData;
export let form: ActionData | undefined = undefined;
</script>

<WorkspacePage {data} {form} />
