<script lang="ts">
import CoursesPageController from "@/features/catalog/components/CoursesPageController.svelte";
import type { PageData } from "./$types";

export let data: PageData;
</script>

<CoursesPageController {data} />
