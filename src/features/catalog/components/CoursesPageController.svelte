<script lang="ts">
import {
  catalogPrimaryName as primaryName,
  catalogSecondaryName as secondaryName,
} from "@/features/catalog/lib/catalog-list-display";
import {
  activeCourseFilterCount,
  courseFilterHref as buildCourseFilterHref,
  buildCourseFilterOptions,
  coursePageHref,
} from "@/features/catalog/lib/courses-page-view-model";
import { goto } from "$app/navigation";
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

$: page = data.pagination.page;
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

function pageHref(targetPage: number) {
  return coursePageHref({ filters: data.filters, targetPage });
}

function courseFilterHref(overrides: Partial<CourseListFilters>) {
  return buildCourseFilterHref({
    courseSearch,
    filters: data.filters,
    overrides: {
      categoryId: overrides.categoryId ?? undefined,
      classTypeId: overrides.classTypeId ?? undefined,
      educationLevelId: overrides.educationLevelId ?? undefined,
    },
  });
}

function updateCourseFilter(overrides: Partial<CourseListFilters>) {
  void goto(courseFilterHref(overrides));
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
    currentLabel={commonLabels.courses}
    description={courseLabels.subtitle}
    homeLabel={commonLabels.home}
    metaLabel={commonLabels.search}
    metaValue={data.filters.search || courseLabels.title}
    title={courseLabels.title}
  />

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

  <CoursesResults
    {courseEmptyDescription}
    {courseLabels}
    {data}
    {page}
    {primaryName}
    {secondaryName}
    {totalPages}
  />

  <CatalogPagination commonLabels={commonLabels} getPageHref={pageHref} {page} {totalPages} />
</section>
