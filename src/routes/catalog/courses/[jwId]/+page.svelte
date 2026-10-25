<script lang="ts">
import CourseDetailPageController from "@/features/catalog/components/CourseDetailPageController.svelte";
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
    return `${page.url.pathname}?${params}#sections`;
  },
});
</script>

<CourseDetailPageController data={{ ...data, course: { ...data.course, sections: endless.items } }} {endless} />
