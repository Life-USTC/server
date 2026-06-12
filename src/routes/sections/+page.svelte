<script lang="ts">
import SectionsPageController from "@/features/catalog/components/SectionsPageController.svelte";
import type { PageData } from "./$types";

export let data: PageData;
</script>

<SectionsPageController {data} />
