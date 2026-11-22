<script lang="ts">
import type { ActionData, PageData } from "./$types";
import Introduction from "./introduction/+page.svelte";

let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<Introduction {data} {form} />
