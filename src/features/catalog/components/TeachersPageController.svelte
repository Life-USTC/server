<script lang="ts">
import {
  type CatalogNamed,
  catalogHref,
  catalogPrimaryName as primaryName,
  catalogSecondaryName as secondaryName,
} from "@/features/catalog/lib/catalog-list-display";
import CatalogMobileFilters from "./CatalogMobileFilters.svelte";
import CatalogPageHeader from "./CatalogPageHeader.svelte";
import CatalogPagination from "./CatalogPagination.svelte";
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
$: teacherActiveFilters = [
  data.filters.search
    ? {
        href: teacherFilterHref({ search: "" }),
        label: `${teacherLabels.searchLabel}: ${data.filters.search}`,
      }
    : null,
  data.filters.departmentId
    ? {
        href: teacherFilterHref({ departmentId: "" }),
        label: `${teacherLabels.department}: ${selectedDepartment ? primaryName(selectedDepartment) : data.filters.departmentId}`,
      }
    : null,
].filter(
  (filter): filter is { href: string; label: string } => filter !== null,
);
$: teacherHiddenFilters = [
  { name: "departmentId", value: data.filters.departmentId ?? "" },
];

function pageHref(targetPage: number) {
  const { search, departmentId } = data.filters;
  return catalogHref("/teachers", { search, departmentId }, targetPage);
}

function teacherFilterHref(overrides: Partial<TeacherListFilters>) {
  const filters = {
    ...data.filters,
    ...overrides,
  };
  const { search, departmentId } = filters;
  return catalogHref("/teachers", { search, departmentId });
}
</script>

<svelte:head><title>{commonLabels.teachers} - Life@USTC</title></svelte:head>

<section class="grid gap-5">
  <CatalogPageHeader
    description={teacherLabels.subtitle}
    title={teacherLabels.title}
  />

  <div class="grid min-w-0 gap-4">
    <CatalogMobileFilters
      activeFilters={teacherActiveFilters}
      clearHref="/teachers"
      clearLabel={commonLabels.clear}
      filterDescription={teacherLabels.filterDescription}
      filterTitle={teacherLabels.filterTitle}
      hiddenFilters={teacherHiddenFilters}
      inlineFilters
      searchId="mobile-teacher-search"
      searchLabel={teacherLabels.searchLabel}
      searchPlaceholder={teacherLabels.searchNameOrCode}
      bind:searchValue={teacherSearch}
    >
      <TeachersFilters
        {activeFilterCount}
        {commonLabels}
        {departmentOptions}
        filters={data.filters}
        idPrefix="mobile-teacher"
        inline
        showClear={false}
        showSearch={false}
        {teacherLabels}
        teacherSearch={data.filters.search ?? ""}
      />
    </CatalogMobileFilters>

    <div class="grid min-w-0 gap-4">
      <TeachersResults
        {commonLabels}
        filters={data.filters}
        page={data.pagination.page}
        {primaryName}
        {secondaryName}
        {selectedDepartment}
        {showSecondaryNames}
        {teacherLabels}
        teachers={data.data}
        total={data.pagination.total}
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
