<script lang="ts">
import TeacherDetailPageController from "@/features/catalog/components/TeacherDetailPageController.svelte";
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
    return `${page.url.pathname}?${params}#sections`;
  },
});
</script>

<TeacherDetailPageController data={{ ...data, teacher: { ...data.teacher, sections: endless.items } }} {endless} />
