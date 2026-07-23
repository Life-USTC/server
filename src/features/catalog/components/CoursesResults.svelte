<script lang="ts">
import type { CatalogNamed } from "@/features/catalog/lib/catalog-list-display";
import {
  catalogShowingSummary,
  optionalCatalogFilterSummary,
} from "@/features/catalog/lib/catalog-results-summary";
import TruncatedBadge from "$lib/components/TruncatedBadge.svelte";
import TruncatedText from "$lib/components/TruncatedText.svelte";
import { Badge } from "$lib/components/ui/badge/index.js";
import * as Item from "$lib/components/ui/item/index.js";
import * as Table from "$lib/components/ui/table/index.js";
import CatalogResultsEmpty from "./CatalogResultsEmpty.svelte";
import CatalogResultsSummary from "./CatalogResultsSummary.svelte";
import CatalogTableLink from "./CatalogTableLink.svelte";
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
    <div class="xl:hidden">
      <Item.Group>
        {#each data.data as course}
          {@const courseHref = `/catalog/courses/${course.jwId}`}
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
                  <Badge variant="outline">{course.code}</Badge>
                </Item.Actions>
                <Item.Footer class="flex-wrap justify-start">
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
    <div class="hidden xl:block">
      <Table.Root class="table-fixed">
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
            {@const courseHref = `/catalog/courses/${course.jwId}`}
            <Table.Row>
              <Table.Cell class="min-w-72 p-0 align-top">
                <CatalogTableLink href={courseHref}>
                  <TruncatedText
                    class="font-medium"
                    text={primaryName(course)}
                  />
                  <TruncatedText
                    class="text-muted-foreground text-xs"
                    text={secondaryName(course)}
                  />
                </CatalogTableLink>
              </Table.Cell>
              <Table.Cell class="p-0 align-top">
                <CatalogTableLink href={courseHref}>
                  <TruncatedBadge text={course.code} />
                </CatalogTableLink>
              </Table.Cell>
              <Table.Cell class="p-0 align-top">
                <CatalogTableLink href={courseHref}>
                  <TruncatedText
                    text={course.educationLevel
                      ? primaryName(course.educationLevel)
                      : "-"}
                  />
                </CatalogTableLink>
              </Table.Cell>
              <Table.Cell class="p-0 align-top">
                <CatalogTableLink href={courseHref}>
                  <TruncatedText
                    text={course.category ? primaryName(course.category) : "-"}
                  />
                </CatalogTableLink>
              </Table.Cell>
              <Table.Cell class="p-0 align-top">
                <CatalogTableLink href={courseHref}>
                  <TruncatedText
                    text={course.classType
                      ? primaryName(course.classType)
                      : "-"}
                  />
                </CatalogTableLink>
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
