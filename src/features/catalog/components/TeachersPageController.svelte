<script lang="ts">
import {
  type CatalogNamed,
  catalogHref,
  catalogPrimaryName as primaryName,
  catalogSecondaryName as secondaryName,
} from "@/features/catalog/lib/catalog-list-display";
import { catalogPageDataHref } from "@/features/catalog/lib/catalog-page-data-href";
import { goto } from "$app/navigation";
import CatalogFilterSidebar from "./CatalogFilterSidebar.svelte";
import CatalogInfinitePager from "./CatalogInfinitePager.svelte";
import CatalogPageHeader from "./CatalogPageHeader.svelte";
import type {
  TeacherListCommonLabels,
  TeacherListFilters,
  TeacherListLabels,
  TeacherListRow,
} from "./catalog-teacher-list-types";
import TeachersFilters from "./TeachersFilters.svelte";
import TeachersResults from "./TeachersResults.svelte";

type DepartmentOption = CatalogNamed & {
  id: number | string;
};
type PageData = {
  data: TeacherListRow[];
  filterOptions: { departments: DepartmentOption[] };
  filters: TeacherListFilters;
  labels: {
    common: TeacherListCommonLabels & {
      home: string;
      loading: string;
      teachers: string;
    };
    teachers: TeacherListLabels & {
      allDepartments: string;
      currentDepartment: string;
      title: string;
    };
  };
  locale: string;
  pagination: {
    page: number;
    total: number;
    totalPages: number;
  };
};

export let data: PageData;

let teacherSearch = data.filters.search ?? "";
let isLoadingMore = false;
let loadedPage = data.pagination.page;
let teacherPageKey = "";
let visibleTeachers: TeacherListRow[] = data.data;

$: totalPages = data.pagination.totalPages;
$: teacherSearch = data.filters.search ?? "";
$: commonLabels = data.labels.common;
$: teacherLabels = data.labels.teachers;
$: showSecondaryNames = data.locale === "en-us";
$: activeFilterCount = [data.filters.search, data.filters.departmentId].filter(
  Boolean,
).length;
$: selectedDepartment =
  data.filterOptions.departments.find(
    (department) => data.filters.departmentId === String(department.id),
  ) ?? null;
$: departmentOptions = [
  { value: "", label: teacherLabels.allDepartments },
  ...data.filterOptions.departments.map((department) => ({
    value: String(department.id),
    label: primaryName(department),
  })),
];
$: nextTeacherPageKey = JSON.stringify({
  filters: data.filters,
  page: data.pagination.page,
});
$: if (nextTeacherPageKey !== teacherPageKey) {
  teacherPageKey = nextTeacherPageKey;
  visibleTeachers = data.data;
  loadedPage = data.pagination.page;
  isLoadingMore = false;
}
$: hasMoreTeachers = loadedPage < totalPages;
$: nextTeacherHref = hasMoreTeachers ? pageHref(loadedPage + 1) : "";

function pageHref(targetPage: number) {
  const { search, departmentId } = data.filters;
  return catalogHref("/teachers", { search, departmentId }, targetPage);
}

function teacherFilterHref(overrides: Partial<TeacherListFilters>) {
  const search = teacherSearch.trim();
  const departmentId =
    overrides.departmentId ?? data.filters.departmentId ?? "";
  return catalogHref("/teachers", { search, departmentId });
}

function updateTeacherFilter(overrides: Partial<TeacherListFilters>) {
  void goto(teacherFilterHref(overrides));
}

async function loadMoreTeachers() {
  if (!hasMoreTeachers || isLoadingMore) return;

  isLoadingMore = true;
  try {
    const response = await fetch(
      catalogPageDataHref("teachers", pageHref(loadedPage + 1)),
    );
    if (!response.ok) return;

    const nextData = (await response.json()) as PageData;
    visibleTeachers = [...visibleTeachers, ...nextData.data];
    loadedPage = nextData.pagination.page;
  } finally {
    isLoadingMore = false;
  }
}
</script>

<svelte:head><title>{commonLabels.teachers} - Life@USTC</title></svelte:head>

<section class="grid gap-5">
  <CatalogPageHeader
    description={teacherLabels.subtitle}
    metaLabel={teacherLabels.currentDepartment}
    metaValue={selectedDepartment ? primaryName(selectedDepartment) : teacherLabels.allDepartments}
    title={teacherLabels.title}
  />

  <div class="-mx-4 grid min-h-[calc(100vh-8rem)] bg-base-100 sm:-mx-5 lg:-mx-6 lg:grid-cols-[17rem_minmax(0,1fr)] lg:items-start">
    <CatalogFilterSidebar
      activeCount={activeFilterCount}
      description={teacherLabels.filterDescription}
      title={teacherLabels.filterTitle}
    >
      <TeachersFilters
        {activeFilterCount}
        {commonLabels}
        {departmentOptions}
        filters={data.filters}
        {teacherLabels}
        bind:teacherSearch
        {updateTeacherFilter}
      />
    </CatalogFilterSidebar>

    <div class="min-w-0 px-4 py-5 sm:px-5 lg:px-6">
      <TeachersResults
        {commonLabels}
        filters={data.filters}
        page={loadedPage}
        {primaryName}
        {secondaryName}
        {selectedDepartment}
        {showSecondaryNames}
        {teacherLabels}
        teachers={visibleTeachers}
        total={data.pagination.total}
        {totalPages}
      />

      <CatalogInfinitePager
        hasMore={hasMoreTeachers}
        loading={isLoadingMore}
        loadingLabel={commonLabels.loading}
        loadMore={loadMoreTeachers}
        nextHref={nextTeacherHref}
        nextLabel={commonLabels.next}
      />
    </div>
  </div>
</section>
