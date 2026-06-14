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
  CourseListLabels,
  CourseListResultData,
} from "./catalog-course-list-types";

export let courseEmptyDescription: () => string;
export let courseLabels: CourseListLabels;
export let data: CourseListResultData;
export let page: number;
export let primaryName: (item: CatalogNamed | null | undefined) => string;
export let secondaryName: (item: CatalogNamed | null | undefined) => string;
export let totalPages: number;

$: courseSummaryBase = catalogShowingSummary(
  courseLabels.showing,
  data.data.length,
  data.pagination.total,
);
$: courseSearchSummary = optionalCatalogFilterSummary(
  data.filters.search,
  courseLabels.searchFor,
  "{query}",
);
</script>

<section class="grid min-w-0 gap-3">
  <CatalogResultsSummary
    base={courseSummaryBase}
    {page}
    searchText={courseSearchSummary}
    {totalPages}
  />
  {#if data.data.length > 0}
    <div class="grid min-w-0 overflow-hidden rounded-md border border-base-300">
      {#each data.data as course}
        {@const courseHref = `/courses/${course.jwId}`}
        <a
          class="grid min-w-0 gap-3 border-base-300 border-b p-3 text-base-content no-underline transition-colors last:border-b-0 hover:bg-base-200/30 md:grid-cols-[minmax(16rem,1.7fr)_minmax(7rem,0.7fr)_minmax(8rem,0.8fr)_minmax(9rem,0.9fr)_minmax(8rem,0.8fr)] md:items-center md:gap-4"
          href={courseHref}
        >
          <div class="grid min-w-0 gap-1">
            <span class="truncate font-medium">{primaryName(course)}</span>
            {#if secondaryName(course)}
              <span class="truncate text-base-content/60 text-xs">{secondaryName(course)}</span>
            {/if}
          </div>
          <Badge class="w-fit font-mono" variant="outline">{course.code}</Badge>
          <div class="flex items-center justify-between gap-3 text-sm md:block">
            <span class="text-base-content/55 md:sr-only">{courseLabels.educationLevel}</span>
            <span>{course.educationLevel ? primaryName(course.educationLevel) : "-"}</span>
          </div>
          <div class="flex items-center justify-between gap-3 text-sm md:block">
            <span class="text-base-content/55 md:sr-only">{courseLabels.category}</span>
            <span>{course.category ? primaryName(course.category) : "-"}</span>
          </div>
          <div class="flex items-center justify-between gap-3 text-sm md:block">
            <span class="text-base-content/55 md:sr-only">{courseLabels.classType}</span>
            <span>{course.classType ? primaryName(course.classType) : "-"}</span>
          </div>
        </a>
      {/each}
    </div>
  {:else}
    <div class="py-10">
      <CatalogResultsEmpty
        centered
        description={courseEmptyDescription()}
        title={courseLabels.noCoursesFound}
      />
    </div>
  {/if}
</section>
