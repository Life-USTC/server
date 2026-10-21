<script lang="ts">
import CollectionPage from "#lib/components/CollectionPage.svelte";
import ListPagination from "#lib/components/ListPagination.svelte";
import { catalogPrimaryName as primaryName } from "@/features/catalog/lib/catalog-list-display";
import { catalogListPageHref } from "@/features/catalog/lib/catalog-list-query";
import {
  buildCourseFilterOptions,
  coursePageHref,
} from "@/features/catalog/lib/courses-page-view-model";
import { page as routePage } from "$app/state";
import CatalogFilters from "./CatalogFilters.svelte";
import CoursesFilters from "./CoursesFilters.svelte";
import CoursesResults from "./CoursesResults.svelte";
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
    common: CourseListCommonLabels & {
      courses: string;
      home: string;
      loading: string;
    };
    courses: CourseListLabels & { title: string };
  };
  pagination: { page: number; total: number; totalPages: number };
};

interface Props {
  data: PageData;
}

let { data }: Props = $props();

let courseSearch = $derived(data.filters.search ?? "");

function pageHref(targetPage: number) {
  return catalogListPageHref(new URL(routePage.url.href), targetPage);
}

function courseFilterHref(overrides: Partial<CourseListFilters>) {
  return coursePageHref({
    filters: {
      ...data.filters,
      ...overrides,
    },
    targetPage: 1,
  });
}

function optionLabel(
  options: Array<{ label: string; value: string }>,
  value: string,
) {
  return options.find((option) => option.value === value)?.label ?? value;
}

function courseEmptyDescription() {
  return data.filters.search
    ? courseLabels.searchFor.replace("{query}", data.filters.search)
    : courseLabels.subtitle;
}
let totalPages = $derived(data.pagination.totalPages);
let commonLabels = $derived(data.labels.common);
let courseLabels = $derived(data.labels.courses);
let { categoryOptions, classTypeOptions, educationLevelOptions } = $derived(
  buildCourseFilterOptions({
    commonLabels,
    filterOptions: data.filterOptions,
  }),
);
let courseResultsData = $derived({
  data: data.data,
  filters: { search: data.filters.search },
  pagination: { total: data.pagination.total },
});
let courseActiveFilters = $derived(
  [
    data.filters.search
      ? {
          href: courseFilterHref({ search: "" }),
          label: `${commonLabels.search}: ${data.filters.search}`,
        }
      : null,
    data.filters.educationLevelId
      ? {
          href: courseFilterHref({ educationLevelId: "" }),
          label: `${courseLabels.educationLevel}: ${optionLabel(educationLevelOptions, data.filters.educationLevelId)}`,
        }
      : null,
    data.filters.categoryId
      ? {
          href: courseFilterHref({ categoryId: "" }),
          label: `${courseLabels.category}: ${optionLabel(categoryOptions, data.filters.categoryId)}`,
        }
      : null,
    data.filters.classTypeId
      ? {
          href: courseFilterHref({ classTypeId: "" }),
          label: `${courseLabels.classType}: ${optionLabel(classTypeOptions, data.filters.classTypeId)}`,
        }
      : null,
  ].filter(
    (filter): filter is { href: string; label: string } => filter !== null,
  ),
);
let courseHiddenFilters = $derived(
  [
    { name: "educationLevelId", value: data.filters.educationLevelId ?? "" },
    { name: "categoryId", value: data.filters.categoryId ?? "" },
    { name: "classTypeId", value: data.filters.classTypeId ?? "" },
  ].filter((filter) => Boolean(filter.value)),
);
</script>


{#snippet paginationFooter()}
  <ListPagination
    ariaLabel={commonLabels.pagination}
    class="py-0"
    nextLabel={commonLabels.next}
    nextPageLabel={commonLabels.nextPage}
    page={data.pagination.page}
    pageHref={pageHref}
    previousLabel={commonLabels.previous}
    previousPageLabel={commonLabels.previousPage}
    totalPages={totalPages}
  />
{/snippet}

<CollectionPage description={courseLabels.subtitle} footer={totalPages > 1 ? paginationFooter : undefined} title={courseLabels.title}>
  {#snippet toolbar()}
    <CatalogFilters
      activeFilters={courseActiveFilters}
      clearHref="/catalog/courses"
      clearLabel={commonLabels.clear}
      filterDescription={courseLabels.filterDescription}
      filterTitle={courseLabels.summary.filters}
      hiddenFilters={courseHiddenFilters}
      searchId="mobile-course-search"
      searchLabel={commonLabels.search}
      searchPlaceholder={courseLabels.searchPlaceholder}
      bind:searchValue={courseSearch}
    >
      <CoursesFilters
        categoryOptions={categoryOptions}
        classTypeOptions={classTypeOptions}
        commonLabels={commonLabels}
        courseLabels={courseLabels}
        courseSearch={courseSearch}
        educationLevelOptions={educationLevelOptions}
        filters={data.filters}
        idPrefix="mobile-course"
      />
    </CatalogFilters>
  {/snippet}
  <CoursesResults
    courseEmptyDescription={courseEmptyDescription}
    courseLabels={courseLabels}
    data={courseResultsData}
    page={data.pagination.page}
    primaryName={primaryName}
    totalPages={totalPages}
  />
</CollectionPage>
