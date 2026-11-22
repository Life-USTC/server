<script lang="ts">
import CatalogSectionHistory from "@/features/catalog/components/CatalogSectionHistory.svelte";
import TeacherDetailPageController from "@/features/catalog/components/TeacherDetailPageController.svelte";
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

<TeacherDetailPageController {data}>
  {#snippet content({ data, copy, detailCopy, notAvailable })}
    <section id="sections" data-detail-tab="sections" class="scroll-mt-4">
      <h2 class="mb-3 section-heading">
        {copy.teacherDetail.teachingSectionsTitle}
      </h2>
      <p class="mb-4 text-sm text-muted-foreground">
        {copy.teacherDetail.teachingSectionsDescription}
      </p>
      <CatalogSectionHistory state={endless} labels={copy.common.endlessScroll}>
        <TeacherDetailSections
          copy={detailCopy}
          locale={data.locale}
          {notAvailable}
          teacher={{ ...data.teacher, sections: endless.items }}
        />
      </CatalogSectionHistory>
    </section>
  {/snippet}
</TeacherDetailPageController>
