<script lang="ts">
import CourseDetailPageController from "@/features/catalog/components/CourseDetailPageController.svelte";
import type { PageData } from "./$types";

export let data: PageData;
</script>

<CourseDetailPageController {data} />
