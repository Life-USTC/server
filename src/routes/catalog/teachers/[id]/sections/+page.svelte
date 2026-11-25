<script lang="ts">
import CatalogDetailPage from "@/features/catalog/components/CatalogDetailPage.svelte";
import CatalogSectionHistory from "@/features/catalog/components/CatalogSectionHistory.svelte";
import TeacherDetailSections from "@/features/catalog/components/TeacherDetailSections.svelte";
import { createEndlessList } from "@/lib/navigation/endless-list.svelte";
import { page } from "$app/state";
import type { PageData } from "./$types";

let { data }: { data: PageData } = $props();
const endless = createEndlessList({
  source: () => data,
  select: (value) => ({
    items: value.teacher.sections,
    ...value.sectionsPagination,
  }),
  key: (row) => row.jwId,
  pageHref: (next) => {
    const params = new URLSearchParams(page.url.search);
    params.set("sectionsPage", String(next));
    return `${page.url.pathname}?${params}`;
  },
});
</script>

<CatalogDetailPage {data}>
  <section id="sections" data-detail-tab="sections" class="scroll-mt-4">
    <h2 class="mb-3 section-heading">
      {data.copy.teacherDetail.teachingSectionsTitle}
    </h2>
    <p class="mb-4 text-sm text-muted-foreground">
      {data.copy.teacherDetail.teachingSectionsDescription}
    </p>
    <CatalogSectionHistory state={endless} labels={data.copy.common.endlessScroll}>
      <TeacherDetailSections
        copy={data.copy}
        locale={data.locale}
        notAvailable={data.copy.teacherDetail.notAvailable}
        teacher={{ ...data.teacher, sections: endless.items }}
      />
    </CatalogSectionHistory>
  </section>
</CatalogDetailPage>
