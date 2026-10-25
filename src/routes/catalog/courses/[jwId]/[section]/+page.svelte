<script lang="ts">
import CourseDetailPage from "../+page.svelte";
import type { PageData } from "./$types";

export let data: PageData;
</script>

<CourseDetailPage {data} />
