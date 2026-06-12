<script lang="ts">
import {
  type CatalogNamed,
  catalogHref,
  catalogPrimaryName as primaryName,
  catalogSecondaryName as secondaryName,
  catalogNames as teacherNames,
} from "@/features/catalog/lib/catalog-list-display";
import { goto } from "$app/navigation";
import CatalogPageHeader from "./CatalogPageHeader.svelte";
import CatalogPagination from "./CatalogPagination.svelte";
import type {
  SectionListCommonLabels,
  SectionListFilters,
  SectionListLabels,
  SectionListRow,
  SectionListSemester,
} from "./catalog-section-list-types";
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
let sectionSearch = data.filters.search ?? "";

$: page = data.pagination.page;
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

function pageHref(targetPage: number) {
  const { search, semesterId } = data.filters;
  return catalogHref("/sections", { search, semesterId }, targetPage);
}

function sectionFilterHref(overrides: Partial<SectionListFilters>) {
  const search = sectionSearch.trim();
  const semesterId = overrides.semesterId ?? data.filters.semesterId ?? "";
  return catalogHref("/sections", { search, semesterId });
}

function updateSectionFilter(overrides: Partial<SectionListFilters>) {
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
    currentLabel={commonLabels.sections}
    description={sectionLabels.subtitle}
    homeLabel={commonLabels.home}
    metaLabel={sectionLabels.semester}
    metaValue={selectedSemester?.nameCn ?? commonLabels.allSemesters}
    title={sectionLabels.title}
  />

  <SectionsFilters
    {activeFilterCount}
    {commonLabels}
    filters={data.filters}
    bind:isSearchHelpOpen
    {sectionLabels}
    bind:sectionSearch
    {semesterOptions}
    {updateSectionFilter}
  />

  <SectionsResults
    {data}
    {page}
    {primaryName}
    {sectionEmptyDescription}
    {sectionLabels}
    {secondaryName}
    {selectedSemester}
    {teacherNames}
    {totalPages}
  />

  <CatalogPagination commonLabels={commonLabels} getPageHref={pageHref} {page} {totalPages} />
</section>
