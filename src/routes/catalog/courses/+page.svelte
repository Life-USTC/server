<script lang="ts">
import CollectionPage from "#lib/components/CollectionPage.svelte";
import EndlessScroll from "#lib/components/EndlessScroll.svelte";
import CatalogFilters from "@/features/catalog/components/CatalogFilters.svelte";
import CoursesResults from "@/features/catalog/components/CoursesResults.svelte";
import { catalogColumnFilters } from "@/features/catalog/components/catalog-column-filters";
import { createCatalogFilterDraft } from "@/features/catalog/lib/catalog-filter-draft.svelte";
import { catalogActiveFilters } from "@/features/catalog/lib/catalog-filter-view";
import { catalogListPageHref } from "@/features/catalog/lib/catalog-list-query";
import { buildCourseFilterOptions } from "@/features/catalog/lib/courses-page-view-model";
import DemoNotice from "@/features/demo/components/DemoNotice.svelte";
import { createEndlessList } from "@/lib/navigation/endless-list.svelte";
import type { TableFilterField } from "@/lib/table-filters";
import { page } from "$app/state";
import type { PageData } from "./$types";

let { data }: { data: PageData } = $props();
const endless = createEndlessList({
  source: () => data,
  select: (value) => ({ items: value.data, ...value.pagination }),
  key: (row) => row.jwId,
  pageHref: (next) => catalogListPageHref(new URL(page.url.href), next),
});
const formId = "course-filters";
const draft = createCatalogFilterDraft(() => data.filters);
const commonLabels = $derived(data.labels.common);
const courseLabels = $derived(data.labels.courses);
const filterOptions = $derived(buildCourseFilterOptions(data.filterOptions));
const fields = $derived<Record<string, TableFilterField>>({
  name: { name: "name", label: courseLabels.courseName },
  code: { name: "code", label: courseLabels.courseCode },
  educationLevel: {
    name: "educationLevelId",
    label: courseLabels.educationLevel,
    options: filterOptions.educationLevelOptions,
  },
  category: {
    name: "categoryId",
    label: courseLabels.category,
    options: filterOptions.categoryOptions,
  },
  classType: {
    name: "classTypeId",
    label: courseLabels.classType,
    options: filterOptions.classTypeOptions,
  },
});
const columnFilters = $derived(
  catalogColumnFilters(fields, {
    values: draft.values,
    onchange: draft.update,
    labels: commonLabels.tableFilters,
    formId,
  }),
);
const activeFilters = $derived(
  catalogActiveFilters(
    "/catalog/courses",
    data.filters,
    [{ name: "search", label: commonLabels.search }, ...Object.values(fields)],
    commonLabels.tableFilters,
  ),
);
const description = $derived(
  data.filters.search
    ? courseLabels.searchFor.replace("{query}", data.filters.search)
    : courseLabels.subtitle,
);
</script>

{#if data.demo}
  <DemoNotice demo={data.demo} locale={data.locale} />
{/if}

{#snippet paginationFooter()}
  <EndlessScroll state={endless} labels={commonLabels.endlessScroll} />
{/snippet}
{#snippet controls()}
  <CatalogFilters {activeFilters} clearHref="/catalog/courses" clearLabel={commonLabels.clear} filterTitle={courseLabels.summary.filters} searchLabel={commonLabels.search} searchPlaceholder={courseLabels.searchPlaceholder} values={draft.values} onchange={draft.update} onsubmit={draft.submit} applyLabel={commonLabels.applyFilters} {formId} />
{/snippet}
<CollectionPage description={courseLabels.subtitle} footer={endless.hasMore ? paginationFooter : undefined} title={courseLabels.title} toolbar={controls}>
  <CoursesResults {columnFilters} {description} {courseLabels} rows={endless.items} />
</CollectionPage>
