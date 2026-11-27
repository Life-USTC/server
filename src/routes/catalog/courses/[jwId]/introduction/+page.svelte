<script lang="ts">
import CatalogDetailPage from "@/features/catalog/components/CatalogDetailPage.svelte";
import OfficialAcademicProfile from "@/features/catalog/components/OfficialAcademicProfile.svelte";
import LazyDescriptionCard from "@/features/descriptions/components/LazyDescriptionCard.svelte";
import type { PageData } from "./$types";

let { data }: { data: PageData } = $props();
</script>

<CatalogDetailPage {data}>
  <section id="introduction" data-detail-tab="introduction" class="scroll-mt-4">
    {#if data.officialProfile}
      <OfficialAcademicProfile profile={data.officialProfile} locale={data.locale} kind="course" />
    {/if}
    {#key `description:course:${data.course.id}`}
      <LazyDescriptionCard
        resolveViewer
        targetType="course"
        targetId={data.course.id}
        initialData={data.descriptionData}
        locale={data.locale}
        copy={data.copy.descriptions}
        heading={data.copy.courseDetail.tabs.description}
        readOnlyReason={data.demo?.readOnlyReason}
      />
    {/key}
  </section>
</CatalogDetailPage>
