<script lang="ts">
import {
  type CatalogNamed,
  catalogHref,
  catalogPrimaryName as primaryName,
  catalogSecondaryName as secondaryName,
} from "@/features/catalog/lib/catalog-list-display";
import { goto } from "$app/navigation";
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

$: page = data.pagination.page;
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
</script>

<svelte:head><title>{commonLabels.teachers} - Life@USTC</title></svelte:head>

<section class="grid gap-5">
  <CatalogPageHeader
    currentLabel={commonLabels.teachers}
    description={teacherLabels.subtitle}
    homeLabel={commonLabels.home}
    metaLabel={teacherLabels.currentDepartment}
    metaValue={selectedDepartment ? primaryName(selectedDepartment) : teacherLabels.allDepartments}
    title={teacherLabels.title}
  />

  <TeachersFilters
    {activeFilterCount}
    {commonLabels}
    {departmentOptions}
    filters={data.filters}
    {teacherLabels}
    bind:teacherSearch
    {updateTeacherFilter}
  />

  <TeachersResults
    {commonLabels}
    filters={data.filters}
    {page}
    {primaryName}
    {secondaryName}
    {selectedDepartment}
    {showSecondaryNames}
    {teacherLabels}
    teachers={data.data}
    total={data.pagination.total}
    {totalPages}
  />

  <CatalogPagination commonLabels={commonLabels} getPageHref={pageHref} {page} {totalPages} />
</section>
