<script lang="ts">
import TeachersPageController from "@/features/catalog/components/TeachersPageController.svelte";
import type { PageData } from "./$types";

export let data: PageData;
</script>

<TeachersPageController {data} />
