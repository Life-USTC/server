<script lang="ts">
import CatalogSectionHistory from "@/features/catalog/components/CatalogSectionHistory.svelte";
import CourseDetailPageController from "@/features/catalog/components/CourseDetailPageController.svelte";
import CourseDetailSections from "@/features/catalog/components/CourseDetailSections.svelte";
import { createEndlessList } from "@/lib/navigation/endless-list.svelte";
import { page } from "$app/state";
import type { PageData } from "./$types";

let { data }: { data: PageData } = $props();
const endless = createEndlessList({
  source: () => data,
  select: (value) => ({
    items: value.course.sections,
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

<CourseDetailPageController {data}>
  {#snippet content({ data, copy, detailCopy, notAvailable, primaryName })}
    <section id="sections" data-detail-tab="sections" class="scroll-mt-4">
      <h2 class="mb-3 section-heading">
        {copy.courseDetail.teachingSections}
      </h2>
      <p class="mb-4 text-sm text-muted-foreground">
        {copy.courseDetail.teachingSectionsDescription}
      </p>
      <CatalogSectionHistory state={endless} labels={copy.common.endlessScroll}>
        <CourseDetailSections
          copy={detailCopy}
          course={{ ...data.course, sections: endless.items }}
          locale={data.locale}
          {notAvailable}
          {primaryName}
        />
      </CatalogSectionHistory>
    </section>
  {/snippet}
</CourseDetailPageController>
