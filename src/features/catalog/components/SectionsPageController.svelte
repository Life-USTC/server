<script lang="ts">
import {
  type CatalogNamed,
  catalogHref,
  catalogPrimaryName as primaryName,
  catalogSecondaryName as secondaryName,
  catalogNames as teacherNames,
} from "@/features/catalog/lib/catalog-list-display";
import { goto } from "$app/navigation";
import CatalogMobileFilters from "./CatalogMobileFilters.svelte";
import CatalogPageHeader from "./CatalogPageHeader.svelte";
import CatalogPagination from "./CatalogPagination.svelte";
import type {
  SectionListCommonLabels,
  SectionListFilters,
  SectionListLabels,
  SectionListRow,
  SectionListSemester,
} from "./catalog-section-list-types";
import SectionSearchHelpDialog from "./SectionSearchHelpDialog.svelte";
import SectionsFilters from "./SectionsFilters.svelte";
import SectionsResults from "./SectionsResults.svelte";

type SemesterOption = SectionListSemester &
  CatalogNamed & {
    id: number | string;
  };
type PageData = {
  data: SectionListRow[];
  filterOptions: { semesters: SemesterOption[] };
  filters: SectionListFilters;
  labels: {
    common: SectionListCommonLabels & {
      allSemesters: string;
      home: string;
      loading: string;
      sections: string;
    };
    sections: SectionListLabels & {
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

let isSearchHelpOpen = false;
let isSectionFilterOpen = false;
let sectionSearch = data.filters.search ?? "";

$: if (isSearchHelpOpen) isSectionFilterOpen = false;
$: totalPages = data.pagination.totalPages;
$: sectionSearch = data.filters.search ?? "";
$: commonLabels = data.labels.common;
$: sectionLabels = data.labels.sections;
$: activeFilterCount = [data.filters.search, data.filters.semesterId].filter(
  Boolean,
).length;
$: selectedSemester =
  data.filterOptions.semesters.find(
    (semester) => data.filters.semesterId === String(semester.id),
  ) ?? null;
$: semesterOptions = [
  { value: "", label: commonLabels.allSemesters },
  ...data.filterOptions.semesters.map((semester) => ({
    value: String(semester.id),
    label: semester.nameCn,
  })),
];
$: sectionResultsData = {
  data: data.data,
  filters: data.filters,
  pagination: { total: data.pagination.total },
};
$: sectionActiveFilters = [
  data.filters.search
    ? {
        href: sectionFilterHref({ search: "" }),
        label: `${commonLabels.search}: ${data.filters.search}`,
      }
    : null,
  data.filters.semesterId
    ? {
        href: sectionFilterHref({ semesterId: "" }),
        label: `${sectionLabels.semester}: ${selectedSemester?.nameCn ?? data.filters.semesterId}`,
      }
    : null,
].filter(
  (filter): filter is { href: string; label: string } => filter !== null,
);
$: sectionHiddenFilters = [
  { name: "semesterId", value: data.filters.semesterId ?? "" },
];

function pageHref(targetPage: number) {
  const { search, semesterId } = data.filters;
  return catalogHref("/sections", { search, semesterId }, targetPage);
}

function sectionFilterHref(overrides: Partial<SectionListFilters>) {
  const filters = {
    ...data.filters,
    search: sectionSearch.trim(),
    ...overrides,
  };
  const { search, semesterId } = filters;
  return catalogHref("/sections", { search, semesterId });
}

function updateSectionFilter(overrides: Partial<SectionListFilters>) {
  isSectionFilterOpen = false;
  void goto(sectionFilterHref(overrides));
}

function sectionEmptyDescription() {
  if (data.filters.search) {
    return sectionLabels.searchFor.replace("{query}", data.filters.search);
  }
  if (selectedSemester) {
    return sectionLabels.inSemester.replace(
      "{semester}",
      selectedSemester.nameCn,
    );
  }
  return sectionLabels.subtitle;
}
</script>

<svelte:head><title>{commonLabels.sections} - Life@USTC</title></svelte:head>

<section class="grid gap-5">
  <CatalogPageHeader
    description={sectionLabels.subtitle}
    title={sectionLabels.title}
  />

  <div class="grid min-w-0 gap-4">
    <CatalogMobileFilters
      activeFilters={sectionActiveFilters}
      clearHref="/sections"
      clearLabel={commonLabels.clear}
      filterTitle={sectionLabels.summary.filters}
      hiddenFilters={sectionHiddenFilters}
      bind:open={isSectionFilterOpen}
      searchId="mobile-section-search"
      searchLabel={commonLabels.search}
      searchPlaceholder={sectionLabels.searchPlaceholder}
      bind:searchValue={sectionSearch}
    >
      <SectionsFilters
        {activeFilterCount}
        {commonLabels}
        filters={data.filters}
        idPrefix="mobile-section"
        bind:isSearchHelpOpen
        {sectionLabels}
        bind:sectionSearch
        {semesterOptions}
        showSearch={false}
        {updateSectionFilter}
      />
    </CatalogMobileFilters>

    <div class="grid min-w-0 gap-4">
      <SectionsResults
        data={sectionResultsData}
        page={data.pagination.page}
        {primaryName}
        {sectionEmptyDescription}
        {sectionLabels}
        {secondaryName}
        {selectedSemester}
        {teacherNames}
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

<SectionSearchHelpDialog bind:isSearchHelpOpen {sectionLabels} />
