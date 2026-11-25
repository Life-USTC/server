<script lang="ts">
import CatalogDetailPage from "@/features/catalog/components/CatalogDetailPage.svelte";
import TeacherDetailSections from "@/features/catalog/components/TeacherDetailSections.svelte";
import type { PageData } from "./$types";

let { data }: { data: PageData } = $props();
</script>

<CatalogDetailPage {data}>
  <TeacherDetailSections {data} />
</CatalogDetailPage>
