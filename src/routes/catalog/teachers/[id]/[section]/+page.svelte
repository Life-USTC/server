<script lang="ts">
import TeacherDetailPage from "../+page.svelte";
import type { PageData } from "./$types";

export let data: PageData;
</script>

<TeacherDetailPage {data} />
