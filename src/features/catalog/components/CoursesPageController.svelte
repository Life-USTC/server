<script lang="ts">
import SlidersHorizontalIcon from "@lucide/svelte/icons/sliders-horizontal";
import {
  catalogPrimaryName as primaryName,
  catalogSecondaryName as secondaryName,
} from "@/features/catalog/lib/catalog-list-display";
import {
  activeCourseFilterCount,
  buildCourseFilterOptions,
  coursePageHref,
} from "@/features/catalog/lib/courses-page-view-model";
import { goto } from "$app/navigation";
import CatalogFilterSidebar from "./CatalogFilterSidebar.svelte";
import CatalogMobileFilters from "./CatalogMobileFilters.svelte";
import CatalogPageHeader from "./CatalogPageHeader.svelte";
import CatalogPagination from "./CatalogPagination.svelte";
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
    courses: CourseListLabels & {
      title: string;
    };
  };
  pagination: {
    page: number;
    total: number;
    totalPages: number;
  };
};

export let data: PageData;

let courseSearch = data.filters.search ?? "";
let isCourseFilterOpen = false;

$: totalPages = data.pagination.totalPages;
$: courseSearch = data.filters.search ?? "";
$: commonLabels = data.labels.common;
$: courseLabels = data.labels.courses;
$: activeFilterCount = activeCourseFilterCount(data.filters);
$: ({ categoryOptions, classTypeOptions, educationLevelOptions } =
  buildCourseFilterOptions({
    commonLabels,
    filterOptions: data.filterOptions,
  }));
$: courseResultsData = {
  data: data.data,
  filters: { search: data.filters.search },
  pagination: { total: data.pagination.total },
};
$: courseActiveFilters = [
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
);
$: courseHiddenFilters = [
  { name: "educationLevelId", value: data.filters.educationLevelId ?? "" },
  { name: "categoryId", value: data.filters.categoryId ?? "" },
  { name: "classTypeId", value: data.filters.classTypeId ?? "" },
];

function pageHref(targetPage: number) {
  return coursePageHref({ filters: data.filters, targetPage });
}

function courseFilterHref(overrides: Partial<CourseListFilters>) {
  return coursePageHref({
    filters: {
      ...data.filters,
      search: courseSearch.trim(),
      ...overrides,
    },
    targetPage: 1,
  });
}

function updateCourseFilter(overrides: Partial<CourseListFilters>) {
  isCourseFilterOpen = false;
  void goto(courseFilterHref(overrides));
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
</script>

<svelte:head><title>{commonLabels.courses} - Life@USTC</title></svelte:head>

<section class="grid gap-5">
  <CatalogPageHeader
    description={courseLabels.subtitle}
    title={courseLabels.title}
  />

  <div class="-mx-4 grid min-h-[calc(100vh-8rem)] bg-background sm:-mx-5 lg:-mx-6 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-start">
    <CatalogMobileFilters
      activeFilters={courseActiveFilters}
      clearHref="/courses"
      clearLabel={commonLabels.clear}
      filterTitle={courseLabels.summary.filters}
      hiddenFilters={courseHiddenFilters}
      bind:open={isCourseFilterOpen}
      searchId="mobile-course-search"
      searchLabel={commonLabels.search}
      searchPlaceholder={courseLabels.searchPlaceholder}
      bind:searchValue={courseSearch}
    >
      <CoursesFilters
        {activeFilterCount}
        {categoryOptions}
        {classTypeOptions}
        {commonLabels}
        {courseLabels}
        bind:courseSearch
        {educationLevelOptions}
        filters={data.filters}
        idPrefix="mobile-course"
        showSearch={false}
        {updateCourseFilter}
      />
    </CatalogMobileFilters>

    <CatalogFilterSidebar
      activeCount={activeFilterCount}
      icon={SlidersHorizontalIcon}
      title={courseLabels.summary.filters}
    >
      <CoursesFilters
        {activeFilterCount}
        {categoryOptions}
        {classTypeOptions}
        {commonLabels}
        {courseLabels}
        bind:courseSearch
        {educationLevelOptions}
        filters={data.filters}
        {updateCourseFilter}
      />
    </CatalogFilterSidebar>

    <div class="min-w-0 px-4 py-5 sm:px-5 lg:px-6">
      <CoursesResults
        {courseEmptyDescription}
        {courseLabels}
        data={courseResultsData}
        page={data.pagination.page}
        {primaryName}
        {secondaryName}
        {totalPages}
      />

      <CatalogPagination
        ariaLabel={commonLabels.pagination}
        nextLabel={commonLabels.next}
        nextPageLabel={commonLabels.nextPage}
        page={data.pagination.page}
        {pageHref}
        previousLabel={commonLabels.previous}
        previousPageLabel={commonLabels.previousPage}
        {totalPages}
      />
    </div>
  </div>
</section>
