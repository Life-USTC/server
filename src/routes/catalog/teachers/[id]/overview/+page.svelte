<script lang="ts">
import CatalogDetailPage from "@/features/catalog/components/CatalogDetailPage.svelte";
import TeacherDetailBasicInfo from "@/features/catalog/components/TeacherDetailBasicInfo.svelte";
import type { PageData } from "./$types";

let { data }: { data: PageData } = $props();
</script>

<CatalogDetailPage {data}>
  <section id="overview" data-detail-tab="overview" class="grid gap-2">
    <TeacherDetailBasicInfo
      copy={data.copy}
      notAvailable={data.copy.teacherDetail.notAvailable}
      teacher={data.teacher}
    />
  </section>
</CatalogDetailPage>
