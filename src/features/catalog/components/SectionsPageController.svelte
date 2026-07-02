<script lang="ts">
import {
  type CatalogNamed,
  catalogHref,
  catalogPrimaryName as primaryName,
  catalogSecondaryName as secondaryName,
  catalogNames as teacherNames,
} from "@/features/catalog/lib/catalog-list-display";
import { catalogPageDataHref } from "@/features/catalog/lib/catalog-page-data-href";
import { goto } from "$app/navigation";
import CatalogFilterSidebar from "./CatalogFilterSidebar.svelte";
import CatalogInfinitePager from "./CatalogInfinitePager.svelte";
import CatalogPageHeader from "./CatalogPageHeader.svelte";
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
let sectionSearch = data.filters.search ?? "";
let isLoadingMore = false;
let loadedPage = data.pagination.page;
let sectionPageKey = "";
let visibleSections: SectionListRow[] = data.data;

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
$: nextSectionPageKey = JSON.stringify({
  filters: data.filters,
  page: data.pagination.page,
});
$: if (nextSectionPageKey !== sectionPageKey) {
  sectionPageKey = nextSectionPageKey;
  visibleSections = data.data;
  loadedPage = data.pagination.page;
  isLoadingMore = false;
}
$: sectionResultsData = {
  ...data,
  data: visibleSections,
  pagination: { total: data.pagination.total },
};
$: hasMoreSections = loadedPage < totalPages;
$: nextSectionHref = hasMoreSections ? pageHref(loadedPage + 1) : "";

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

async function loadMoreSections() {
  if (!hasMoreSections || isLoadingMore) return;

  isLoadingMore = true;
  try {
    const response = await fetch(
      catalogPageDataHref("sections", pageHref(loadedPage + 1)),
    );
    if (!response.ok) return;

    const nextData = (await response.json()) as PageData;
    visibleSections = [...visibleSections, ...nextData.data];
    loadedPage = nextData.pagination.page;
  } finally {
    isLoadingMore = false;
  }
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
    metaLabel={sectionLabels.semester}
    metaValue={selectedSemester?.nameCn ?? commonLabels.allSemesters}
    title={sectionLabels.title}
  />

  <div class="-mx-4 grid min-h-[calc(100vh-8rem)] bg-base-100 sm:-mx-5 lg:-mx-6 lg:grid-cols-[17rem_minmax(0,1fr)] lg:items-start">
    <CatalogFilterSidebar
      activeCount={activeFilterCount}
      description={sectionLabels.subtitle}
      title={sectionLabels.summary.filters}
    >
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
    </CatalogFilterSidebar>

    <div class="min-w-0 px-4 py-5 sm:px-5 lg:px-6">
      <SectionsResults
        data={sectionResultsData}
        page={loadedPage}
        {primaryName}
        {sectionEmptyDescription}
        {sectionLabels}
        {secondaryName}
        {selectedSemester}
        {teacherNames}
        {totalPages}
      />

      <CatalogInfinitePager
        hasMore={hasMoreSections}
        loading={isLoadingMore}
        loadingLabel={commonLabels.loading}
        loadMore={loadMoreSections}
        nextHref={nextSectionHref}
        nextLabel={commonLabels.next}
      />
    </div>
  </div>
</section>
