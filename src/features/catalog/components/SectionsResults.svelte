<script lang="ts">
import type { CatalogNamed } from "@/features/catalog/lib/catalog-list-display";
import {
  catalogShowingSummary,
  optionalCatalogFilterSummary,
} from "@/features/catalog/lib/catalog-results-summary";
import { Badge } from "$lib/components/ui/badge/index.js";
import CatalogResultsEmpty from "./CatalogResultsEmpty.svelte";
import CatalogResultsSummary from "./CatalogResultsSummary.svelte";
import type {
  SectionListFilters,
  SectionListLabels,
  SectionListPagination,
  SectionListResultData,
  SectionListSemester,
} from "./catalog-section-list-types";

export let data: SectionListResultData;
export let page: number;
export let primaryName: (item: CatalogNamed | null | undefined) => string;
export let sectionEmptyDescription: () => string;
export let sectionLabels: SectionListLabels;
export let secondaryName: (item: CatalogNamed | null | undefined) => string;
export let selectedSemester: SectionListSemester | null | undefined;
export let teacherNames: (teachers: CatalogNamed[]) => string;
export let totalPages: number;

$: filters = data.filters as SectionListFilters;
$: pagination = data.pagination as SectionListPagination;
$: sectionSummaryBase = catalogShowingSummary(
  sectionLabels.showing,
  data.data.length,
  pagination.total,
);
$: sectionSearchSummary = optionalCatalogFilterSummary(
  filters.search,
  sectionLabels.searchFor,
  "{query}",
);
$: sectionSemesterSummary = selectedSemester
  ? sectionLabels.inSemester.replace("{semester}", selectedSemester.nameCn)
  : "";
</script>

<section class="grid min-w-0 gap-3">
  <CatalogResultsSummary
    base={sectionSummaryBase}
    {page}
    searchText={sectionSearchSummary}
    semesterText={sectionSemesterSummary}
    {totalPages}
  />
  {#if data.data.length > 0}
    <div class="grid min-w-0 w-full overflow-hidden rounded-md border border-base-300">
      {#each data.data as section}
        {@const sectionHref = `/sections/${section.jwId}`}
        <a
          class="grid min-w-0 w-full gap-3 border-base-300 border-b p-3 text-base-content no-underline transition-colors last:border-b-0 hover:bg-base-200/30 md:grid-cols-[minmax(8rem,0.85fr)_minmax(14rem,1.5fr)_minmax(8rem,0.75fr)_minmax(10rem,1fr)_4rem_5.5rem_5rem] md:items-center md:gap-4"
          href={sectionHref}
        >
          <div class="flex flex-wrap items-center gap-2 md:block">
            <span class="text-base-content/55 text-sm md:sr-only">{sectionLabels.semester}</span>
            <span class="text-base-content/70 text-sm">
              {section.semester?.nameCn ?? sectionLabels.noSemester}
            </span>
          </div>
          <div class="grid min-w-0 gap-1">
            <span class="truncate font-medium">{primaryName(section.course)}</span>
            {#if secondaryName(section.course)}
              <span class="truncate text-base-content/60 text-xs">{secondaryName(section.course)}</span>
            {/if}
          </div>
          <Badge class="w-fit font-mono" variant="outline">{section.code}</Badge>
          <div class="grid min-w-0 gap-1 text-sm">
            <span class="text-base-content/55 md:sr-only">{sectionLabels.teachers}</span>
            <span class="truncate">{teacherNames(section.teachers) || "-"}</span>
          </div>
          <div class="flex items-center justify-between gap-3 text-sm md:block md:text-right">
            <span class="text-base-content/55 md:sr-only">{sectionLabels.credits}</span>
            <span class="tabular-nums">{section.credits ?? "-"}</span>
          </div>
          <div class="flex items-center justify-between gap-3 text-sm md:block md:text-right">
            <span class="text-base-content/55 md:sr-only">{sectionLabels.capacity}</span>
            <span class="tabular-nums">{section.stdCount ?? 0} / {section.limitCount ?? "-"}</span>
          </div>
          <div class="flex items-center justify-between gap-3 text-sm md:block md:text-right">
            <span class="text-base-content/55 md:sr-only">{sectionLabels.campus}</span>
            <span class="truncate">
              {section.campus ? primaryName(section.campus) : "-"}
            </span>
          </div>
        </a>
      {/each}
    </div>
  {:else}
    <div class="py-10">
      <CatalogResultsEmpty
        centered
        description={sectionEmptyDescription()}
        title={sectionLabels.noSectionsFound}
      />
    </div>
  {/if}
</section>
