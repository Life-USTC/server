<script lang="ts">
import YoungActivityRemindersPage from "@/features/young/components/YoungActivityRemindersPage.svelte";
import type { PageData } from "./$types";

let { data }: { data: PageData } = $props();
</script>

<YoungActivityRemindersPage {data} />
