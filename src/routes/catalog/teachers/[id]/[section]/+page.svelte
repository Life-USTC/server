<script lang="ts">
import TeacherDetailPageController from "@/features/catalog/components/TeacherDetailPageController.svelte";
import type { PageData } from "./$types";

export let data: PageData;
</script>

<TeacherDetailPageController {data} />
