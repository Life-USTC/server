<script lang="ts">
import {
  type CatalogNamed,
  catalogLocalizedDisplayName,
} from "@/features/catalog/lib/catalog-list-display";
import {
  catalogShowingSummary,
  optionalCatalogFilterSummary,
} from "@/features/catalog/lib/catalog-results-summary";
import { page as appPage } from "$app/stores";
import TruncatedCode from "$lib/components/TruncatedCode.svelte";
import TruncatedText from "$lib/components/TruncatedText.svelte";
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
export let totalPages: number;

$: locale = $appPage.data.locale ?? "zh-cn";
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
                  <Item.Title>{catalogLocalizedDisplayName(course, locale)}</Item.Title>
                </Item.Content>
                <Item.Actions>
                  <TruncatedCode text={course.code} />
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
      <Table.Root class="">
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
            {@const courseHref = `/catalog/courses/${course.jwId}`}
            <Table.Row>
              <Table.Cell class="p-0">
                <CatalogTableLink href={courseHref}>
                  <TruncatedText
                    text={catalogLocalizedDisplayName(course, locale)}
                  />
                </CatalogTableLink>
              </Table.Cell>
              <Table.Cell class="p-0">
                <CatalogTableLink href={courseHref}>
                  <TruncatedCode text={course.code} />
                </CatalogTableLink>
              </Table.Cell>
              <Table.Cell class="p-0">
                <CatalogTableLink href={courseHref}>
                  {course.educationLevel
                    ? primaryName(course.educationLevel)
                    : "-"}
                </CatalogTableLink>
              </Table.Cell>
              <Table.Cell class="p-0">
                <CatalogTableLink href={courseHref}>
                  {course.category ? primaryName(course.category) : "-"}
                </CatalogTableLink>
              </Table.Cell>
              <Table.Cell class="p-0">
                <CatalogTableLink href={courseHref}>
                  {course.classType ? primaryName(course.classType) : "-"}
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
