<script lang="ts">
import CatalogDetailPage from "@/features/catalog/components/CatalogDetailPage.svelte";
import CourseDetailBasicInfo from "@/features/catalog/components/CourseDetailBasicInfo.svelte";
import type { PageData } from "./$types";

let { data }: { data: PageData } = $props();
</script>

<CatalogDetailPage {data}>
  <section id="overview" data-detail-tab="overview" class="grid gap-2">
    <CourseDetailBasicInfo
      copy={data.copy}
      course={data.course}
    />
  </section>
</CatalogDetailPage>
