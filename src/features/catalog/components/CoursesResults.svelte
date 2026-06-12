<script lang="ts">
import type { CatalogNamed } from "@/features/catalog/lib/catalog-list-display";
import {
  catalogShowingSummary,
  optionalCatalogFilterSummary,
} from "@/features/catalog/lib/catalog-results-summary";
import { Badge } from "$lib/components/ui/badge/index.js";
import * as Table from "$lib/components/ui/table/index.js";
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

<div class="grid gap-3 md:hidden">
  {#each data.data as course}
    <a
      class="border-base-300 border-b py-3 no-underline transition-colors hover:bg-base-200/30"
      href={`/courses/${course.jwId}`}
    >
      <div class="grid gap-3">
        <div>
          <h2 class="font-semibold text-base">{primaryName(course)}</h2>
          {#if secondaryName(course)}<p class="mt-1 text-base-content/60 text-sm">{secondaryName(course)}</p>{/if}
        </div>
        <div class="flex flex-wrap gap-1.5 text-sm">
          <Badge class="font-mono" variant="outline">{course.code}</Badge>
          {#if course.educationLevel}<Badge variant="ghost">{primaryName(course.educationLevel)}</Badge>{/if}
          {#if course.category}<Badge variant="ghost">{primaryName(course.category)}</Badge>{/if}
          {#if course.classType}<Badge variant="ghost">{primaryName(course.classType)}</Badge>{/if}
        </div>
      </div>
    </a>
  {:else}
    <CatalogResultsEmpty
      description={courseEmptyDescription()}
      title={courseLabels.noCoursesFound}
    />
  {/each}
</div>

<section class="hidden min-w-0 gap-3 md:grid">
  <CatalogResultsSummary
    base={courseSummaryBase}
    {page}
    searchText={courseSearchSummary}
    {totalPages}
  />
  <div class="overflow-x-auto">
    {#if data.data.length > 0}
      <Table.Root>
        <Table.Header>
          <Table.Row>
            <Table.Head>{courseLabels.courseName}</Table.Head>
            <Table.Head>{courseLabels.courseCode}</Table.Head>
            <Table.Head>{courseLabels.educationLevel}</Table.Head>
            <Table.Head>{courseLabels.category}</Table.Head>
            <Table.Head>{courseLabels.classType}</Table.Head>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {#each data.data as course}
            {@const courseHref = `/courses/${course.jwId}`}
            <Table.Row>
              <Table.Cell class="min-w-80 p-0">
                <Table.CellLink class="text-base-content" href={courseHref}>
                  <span class="font-medium hover:underline">{primaryName(course)}</span>
                  {#if secondaryName(course)}
                    <span class="block text-base-content/60 text-xs">{secondaryName(course)}</span>
                  {/if}
                </Table.CellLink>
              </Table.Cell>
              <Table.Cell class="p-0">
                <Table.CellLink href={courseHref}>
                  <Badge class="font-mono" variant="outline">{course.code}</Badge>
                </Table.CellLink>
              </Table.Cell>
              <Table.Cell class="p-0">
                <Table.CellLink href={courseHref}>
                  {#if course.educationLevel}<Badge variant="ghost">{primaryName(course.educationLevel)}</Badge>{:else}<span class="text-base-content/40">-</span>{/if}
                </Table.CellLink>
              </Table.Cell>
              <Table.Cell class="p-0">
                <Table.CellLink href={courseHref}>
                  {#if course.category}<Badge variant="ghost">{primaryName(course.category)}</Badge>{:else}<span class="text-base-content/40">-</span>{/if}
                </Table.CellLink>
              </Table.Cell>
              <Table.Cell class="p-0">
                <Table.CellLink href={courseHref}>
                  {#if course.classType}<Badge variant="ghost">{primaryName(course.classType)}</Badge>{:else}<span class="text-base-content/40">-</span>{/if}
                </Table.CellLink>
              </Table.Cell>
            </Table.Row>
          {/each}
        </Table.Body>
      </Table.Root>
    {:else}
      <div class="py-10">
        <CatalogResultsEmpty
          centered
          description={courseEmptyDescription()}
          title={courseLabels.noCoursesFound}
        />
      </div>
    {/if}
  </div>
</section>
