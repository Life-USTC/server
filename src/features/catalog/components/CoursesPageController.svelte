<script lang="ts">
import CollectionPage from "#lib/components/CollectionPage.svelte";
import EndlessScroll from "#lib/components/EndlessScroll.svelte";
import {
  catalogActiveFilters,
  catalogFilterDraft,
} from "@/features/catalog/lib/catalog-filter-view";
import { catalogPrimaryName as primaryName } from "@/features/catalog/lib/catalog-list-display";
import { buildCourseFilterOptions } from "@/features/catalog/lib/courses-page-view-model";
import type { EndlessScrollState } from "@/lib/navigation/endless-list.svelte";
import type { TableFilterField } from "@/lib/table-filters";
import CatalogFilters from "./CatalogFilters.svelte";
import CoursesResults from "./CoursesResults.svelte";
import type { CatalogColumnFilterProps } from "./catalog-column-filter-types";
import type {
  CourseListCommonLabels,
  CourseListFilterOptions,
  CourseListFilters,
  CourseListLabels,
  CourseListRow,
} from "./catalog-course-list-types";

type PageData = {
  data: CourseListRow[];
  filterOptions: CourseListFilterOptions;
  filters: CourseListFilters;
  labels: {
    common: CourseListCommonLabels;
    courses: CourseListLabels & { title: string };
  };
  pagination: { page: number; total: number; totalPages: number };
};
let { data, endless }: { data: PageData; endless: EndlessScrollState } =
  $props();
const formId = "course-filters";
const appliedFilters = $derived(data.filters);
let draft = $derived(catalogFilterDraft(appliedFilters));
const commonLabels = $derived(data.labels.common);
const courseLabels = $derived(data.labels.courses);
function update(patch: Record<string, string>) {
  draft = { ...draft, ...patch };
}
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
const columnFilters = $derived<Record<string, CatalogColumnFilterProps>>(
  Object.fromEntries(
    Object.entries(fields).map(([key, field]) => [
      key,
      {
        label: field.label,
        fields: [field],
        values: draft,
        onchange: update,
        labels: commonLabels.tableFilters,
        formId,
      },
    ]),
  ),
);
const activeFilters = $derived(
  catalogActiveFilters(
    "/catalog/courses",
    data.filters,
    [{ name: "search", label: commonLabels.search }, ...Object.values(fields)],
    commonLabels.tableFilters,
  ),
);
const resultData = $derived({
  data: data.data,
  filters: data.filters,
});
function emptyDescription() {
  return data.filters.search
    ? courseLabels.searchFor.replace("{query}", data.filters.search)
    : courseLabels.subtitle;
}
</script>

{#snippet paginationFooter()}
  <EndlessScroll state={endless} labels={commonLabels.endlessScroll} />
{/snippet}
{#snippet controls()}
  <CatalogFilters {activeFilters} clearHref="/catalog/courses" clearLabel={commonLabels.clear} filterTitle={courseLabels.summary.filters} searchLabel={commonLabels.search} searchPlaceholder={courseLabels.searchPlaceholder} values={draft} onchange={update} applyLabel={commonLabels.applyFilters} {formId} />
{/snippet}
<CollectionPage description={courseLabels.subtitle} footer={endless.hasMore ? paginationFooter : undefined} title={courseLabels.title} toolbar={controls}>
  <CoursesResults {columnFilters} courseEmptyDescription={emptyDescription} {courseLabels} data={resultData} primaryName={primaryName} />
</CollectionPage>
