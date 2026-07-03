<script lang="ts">
import SlidersHorizontalIcon from "@lucide/svelte/icons/sliders-horizontal";
import {
  catalogPrimaryName as primaryName,
  catalogSecondaryName as secondaryName,
} from "@/features/catalog/lib/catalog-list-display";
import { catalogPageDataHref } from "@/features/catalog/lib/catalog-page-data-href";
import {
  activeCourseFilterCount,
  courseFilterHref as buildCourseFilterHref,
  buildCourseFilterOptions,
  coursePageHref,
} from "@/features/catalog/lib/courses-page-view-model";
import { goto } from "$app/navigation";
import CatalogFilterSidebar from "./CatalogFilterSidebar.svelte";
import CatalogInfinitePager from "./CatalogInfinitePager.svelte";
import CatalogPageHeader from "./CatalogPageHeader.svelte";
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
let coursePageKey = "";
let isLoadingMore = false;
let loadedPage = data.pagination.page;
let visibleCourses: CourseListRow[] = data.data;

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
$: nextCoursePageKey = JSON.stringify({
  filters: data.filters,
  page: data.pagination.page,
});
$: if (nextCoursePageKey !== coursePageKey) {
  coursePageKey = nextCoursePageKey;
  visibleCourses = data.data;
  loadedPage = data.pagination.page;
  isLoadingMore = false;
}
$: courseResultsData = {
  ...data,
  data: visibleCourses,
  filters: { search: data.filters.search },
  pagination: { total: data.pagination.total },
};
$: hasMoreCourses = loadedPage < totalPages;
$: nextCourseHref = hasMoreCourses ? pageHref(loadedPage + 1) : "";

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

async function loadMoreCourses() {
  if (!hasMoreCourses || isLoadingMore) return;

  isLoadingMore = true;
  try {
    const response = await fetch(
      catalogPageDataHref("courses", pageHref(loadedPage + 1)),
    );
    if (!response.ok) return;

    const nextData = (await response.json()) as PageData;
    visibleCourses = [...visibleCourses, ...nextData.data];
    loadedPage = nextData.pagination.page;
  } finally {
    isLoadingMore = false;
  }
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
    metaLabel={commonLabels.search}
    metaValue={data.filters.search || courseLabels.title}
    title={courseLabels.title}
  />

  <div class="-mx-4 grid min-h-[calc(100vh-8rem)] bg-base-100 sm:-mx-5 lg:-mx-6 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-start">
    <CatalogFilterSidebar
      activeCount={activeFilterCount}
      description={courseLabels.subtitle}
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
        page={loadedPage}
        {primaryName}
        {secondaryName}
        {totalPages}
      />

      <CatalogInfinitePager
        hasMore={hasMoreCourses}
        loading={isLoadingMore}
        loadingLabel={commonLabels.loading}
        loadMore={loadMoreCourses}
        nextHref={nextCourseHref}
        nextLabel={commonLabels.next}
      />
    </div>
  </div>
</section>
