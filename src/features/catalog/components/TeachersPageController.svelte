<script lang="ts">
import CollectionPage from "#lib/components/CollectionPage.svelte";
import ListPagination from "#lib/components/ListPagination.svelte";
import {
  type CatalogNamed,
  catalogHref,
  catalogPrimaryName as primaryName,
} from "@/features/catalog/lib/catalog-list-display";
import { catalogListPageHref } from "@/features/catalog/lib/catalog-list-query";
import { page as routePage } from "$app/state";
import CatalogFilters from "./CatalogFilters.svelte";
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
  pagination: { page: number; total: number; totalPages: number };
};

interface Props {
  data: PageData;
}

let { data }: Props = $props();

let teacherSearch = $derived(data.filters.search ?? "");

function pageHref(targetPage: number) {
  return catalogListPageHref(new URL(routePage.url.href), targetPage);
}

function teacherFilterHref(overrides: Partial<TeacherListFilters>) {
  const filters = {
    ...data.filters,
    ...overrides,
  };
  const { search, departmentId } = filters;
  return catalogHref("/catalog/teachers", { search, departmentId });
}
let totalPages = $derived(data.pagination.totalPages);
let commonLabels = $derived(data.labels.common);
let teacherLabels = $derived(data.labels.teachers);
let selectedDepartment = $derived(
  data.filterOptions.departments.find(
    (department) => data.filters.departmentId === String(department.id),
  ) ?? null,
);
let departmentOptions = $derived([
  { value: "", label: teacherLabels.allDepartments },
  ...data.filterOptions.departments.map((department) => ({
    value: String(department.id),
    label: primaryName(department),
  })),
]);
let teacherActiveFilters = $derived(
  [
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
  ),
);
let teacherHiddenFilters = $derived(
  [{ name: "departmentId", value: data.filters.departmentId ?? "" }].filter(
    (filter) => Boolean(filter.value),
  ),
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

<CollectionPage description={teacherLabels.subtitle} footer={totalPages > 1 ? paginationFooter : undefined} title={teacherLabels.title}>
  {#snippet toolbar()}
    <CatalogFilters
      activeFilters={teacherActiveFilters}
      clearHref="/catalog/teachers"
      clearLabel={commonLabels.clear}
      filterDescription={teacherLabels.filterDescription}
      filterTitle={teacherLabels.filterTitle}
      hiddenFilters={teacherHiddenFilters}
      searchId="mobile-teacher-search"
      searchLabel={teacherLabels.searchLabel}
      searchPlaceholder={teacherLabels.searchNameOrCode}
      bind:searchValue={teacherSearch}
    >
      <TeachersFilters
        commonLabels={commonLabels}
        departmentOptions={departmentOptions}
        filters={data.filters}
        idPrefix="mobile-teacher"
        teacherLabels={teacherLabels}
        teacherSearch={teacherSearch}
      />
    </CatalogFilters>
  {/snippet}

  <TeachersResults
    commonLabels={commonLabels}
    filters={data.filters}
    page={data.pagination.page}
    primaryName={primaryName}
    selectedDepartment={selectedDepartment}
    teacherLabels={teacherLabels}
    teachers={data.data}
    total={data.pagination.total}
    totalPages={totalPages}
  />
</CollectionPage>
