<script lang="ts">
import type { CatalogNamed } from "@/features/catalog/lib/catalog-list-display";
import {
  catalogShowingSummary,
  optionalCatalogFilterSummary,
} from "@/features/catalog/lib/catalog-results-summary";
import { Badge } from "$lib/components/ui/badge/index.js";
import * as Item from "$lib/components/ui/item/index.js";
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

<section class="grid min-w-0 gap-3">
  <CatalogResultsSummary
    base={courseSummaryBase}
    {page}
    searchText={courseSearchSummary}
    {totalPages}
  />
  {#if data.data.length > 0}
    <div class="md:hidden">
      <Item.Group>
        {#each data.data as course}
          {@const courseHref = `/courses/${course.jwId}`}
          <Item.Root variant="outline" size="sm">
            {#snippet child({ props })}
              <a href={courseHref} {...props}>
                <Item.Content>
                  <Item.Title>{primaryName(course)}</Item.Title>
                  {#if secondaryName(course)}
                    <Item.Description>{secondaryName(course)}</Item.Description>
                  {/if}
                </Item.Content>
                <Item.Actions>
                  <Badge class="font-mono" variant="outline">{course.code}</Badge>
                </Item.Actions>
                <Item.Footer class="flex-wrap justify-start text-muted-foreground text-xs">
                  <span>{course.educationLevel ? primaryName(course.educationLevel) : "-"}</span>
                  <span>{course.category ? primaryName(course.category) : "-"}</span>
                  <span>{course.classType ? primaryName(course.classType) : "-"}</span>
                </Item.Footer>
              </a>
            {/snippet}
          </Item.Root>
        {/each}
      </Item.Group>
    </div>
    <div class="hidden md:block">
      <Table.Root>
        <Table.Header>
          <Table.Row>
            <Table.Head class="min-w-72">{courseLabels.courseName}</Table.Head>
            <Table.Head class="w-28">{courseLabels.courseCode}</Table.Head>
            <Table.Head class="w-36">{courseLabels.educationLevel}</Table.Head>
            <Table.Head class="w-40">{courseLabels.category}</Table.Head>
            <Table.Head class="w-36">{courseLabels.classType}</Table.Head>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {#each data.data as course}
            {@const courseHref = `/courses/${course.jwId}`}
            <Table.Row>
              <Table.Cell class="min-w-72 p-0 align-top">
                <Table.CellLink class="px-3 py-2 text-base-content" href={courseHref}>
                  <span class="font-medium">{primaryName(course)}</span>
                  {#if secondaryName(course)}
                    <span class="block text-muted-foreground text-xs">{secondaryName(course)}</span>
                  {/if}
                </Table.CellLink>
              </Table.Cell>
              <Table.Cell class="p-0 align-top">
                <Table.CellLink class="px-3 py-2" href={courseHref}>
                  <Badge class="font-mono" variant="outline">{course.code}</Badge>
                </Table.CellLink>
              </Table.Cell>
              <Table.Cell class="p-0 align-top">
                <Table.CellLink class="px-3 py-2 text-base-content" href={courseHref}>
                  {course.educationLevel ? primaryName(course.educationLevel) : "-"}
                </Table.CellLink>
              </Table.Cell>
              <Table.Cell class="p-0 align-top">
                <Table.CellLink class="px-3 py-2 text-base-content" href={courseHref}>
                  {course.category ? primaryName(course.category) : "-"}
                </Table.CellLink>
              </Table.Cell>
              <Table.Cell class="p-0 align-top">
                <Table.CellLink class="px-3 py-2 text-base-content" href={courseHref}>
                  {course.classType ? primaryName(course.classType) : "-"}
                </Table.CellLink>
              </Table.Cell>
            </Table.Row>
          {/each}
        </Table.Body>
      </Table.Root>
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
