<script lang="ts">
import AnonymousHomePageController from "@/features/dashboard/components/AnonymousHomePageController.svelte";
import type { PageData } from "./$types";

export let data: PageData;
</script>

<AnonymousHomePageController {data} />
