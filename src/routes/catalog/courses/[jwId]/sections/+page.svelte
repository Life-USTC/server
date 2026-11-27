<script lang="ts">
import CatalogDetailPage from "@/features/catalog/components/CatalogDetailPage.svelte";
import CourseDetailSections from "@/features/catalog/components/CourseDetailSections.svelte";
import type { PageData } from "./$types";

let { data }: { data: PageData } = $props();
</script>

<CatalogDetailPage {data}>
  <CourseDetailSections {data} />
</CatalogDetailPage>
