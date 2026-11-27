<script lang="ts">
import CatalogListPage from "@/features/catalog/components/CatalogListPage.svelte";
import CoursesResults from "@/features/catalog/components/CoursesResults.svelte";
import { catalogColumnFilters } from "@/features/catalog/components/catalog-column-filters";
import { catalogActiveFilters } from "@/features/catalog/lib/catalog-filter-view";
import { buildCourseFilterOptions } from "@/features/catalog/lib/courses-page-view-model";
import { createCatalogList } from "@/features/catalog/lib/create-catalog-list";
import type { TableFilterField } from "@/lib/table-filters";
import type { PageData } from "./$types";

let { data }: { data: PageData } = $props();
const { endless, draft } = createCatalogList(
  () => data,
  (row) => row.jwId,
);
const formId = "course-filters";
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

<CatalogListPage
  title={courseLabels.title} description={courseLabels.subtitle}
  demo={data.demo} locale={data.locale}
  {endless} {commonLabels} {activeFilters}
  clearHref="/catalog/courses" filterTitle={courseLabels.summary.filters}
  searchLabel={commonLabels.search} searchPlaceholder={courseLabels.searchPlaceholder}
  {draft} {formId}
>
  <CoursesResults {columnFilters} {description} {courseLabels} rows={endless.items} />
</CatalogListPage>
