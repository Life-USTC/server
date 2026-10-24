<script lang="ts">
import type { Snippet } from "svelte";
import MobileListCard from "#lib/components/MobileListCard.svelte";
import ResponsiveCollection from "#lib/components/ResponsiveCollection.svelte";
import ResultsEmpty from "#lib/components/ResultsEmpty.svelte";
import ResultsSummary from "#lib/components/ResultsSummary.svelte";
import TableControlsRow from "#lib/components/TableControlsRow.svelte";
import TruncatedCode from "#lib/components/TruncatedCode.svelte";
import TruncatedText from "#lib/components/TruncatedText.svelte";
import * as Item from "#lib/components/ui/item/index.js";
import * as Table from "#lib/components/ui/table/index.js";
import {
  type CatalogNamed,
  catalogLocalizedDisplayName,
} from "@/features/catalog/lib/catalog-list-display";
import {
  catalogShowingSummary,
  optionalCatalogFilterSummary,
} from "@/features/catalog/lib/catalog-results-summary";
import { page as routePage } from "$app/state";
import CatalogColumnFilter from "./CatalogColumnFilter.svelte";
import CatalogEntityName from "./CatalogEntityName.svelte";
import CatalogTableLink from "./CatalogTableLink.svelte";
import type { CatalogColumnFilterProps } from "./catalog-column-filter-types";
import type {
  CourseListLabels,
  CourseListResultData,
} from "./catalog-course-list-types";

interface Props {
  controls: Snippet<[string]>;
  columnFilters: Record<string, CatalogColumnFilterProps>;
  courseEmptyDescription: () => string;
  courseLabels: CourseListLabels;
  data: CourseListResultData;
  page: number;
  primaryName: (item: CatalogNamed | null | undefined) => string;
  totalPages: number;
}

let {
  controls,
  columnFilters,
  courseEmptyDescription,
  courseLabels,
  data,
  page,
  primaryName,
  totalPages,
}: Props = $props();

let locale = $derived(routePage.data.locale ?? "zh-cn");
let courseSummaryBase = $derived(
  catalogShowingSummary(
    data.pagination.total === 1
      ? courseLabels.showingOne
      : courseLabels.showing,
    data.data.length,
    data.pagination.total,
  ),
);
let courseSearchSummary = $derived(
  optionalCatalogFilterSummary(
    data.filters.search,
    courseLabels.searchFor,
    "{query}",
  ),
);
</script>


{#snippet empty()}
    <div class="py-10">
      <ResultsEmpty
        description={courseEmptyDescription()}
        title={courseLabels.noCoursesFound}
      />
    </div>
{/snippet}

<section class="grid min-w-0 gap-3">
  <ResultsSummary
    summary={[courseSummaryBase, courseSearchSummary].filter(Boolean).join(" ")}
    page={page}
    totalPages={totalPages}
  />
    <ResponsiveCollection>
      {#snippet mobile()}
        <div class="grid gap-3" data-slot="collection-header">
          {@render controls("mobile")}
          <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
            {#each Object.entries(columnFilters) as [key, column] (key)}
              <CatalogColumnFilter {...column} align="start" idPrefix={"mobile-course-" + key} />
            {/each}
          </div>
        </div>
        {#if data.data.length > 0}
        <Item.Group class="gap-0" role="list">
          {#each data.data as course, index}
            {@const courseHref = `/catalog/courses/${course.jwId}`}
            <div role="listitem">
              <MobileListCard size="sm">
                {#snippet child({ props })}
                  <a href={courseHref} {...props}>
                    <Item.Content><Item.Title><CatalogEntityName item={course} locale={locale} /></Item.Title></Item.Content>
                    <Item.Actions><TruncatedCode text={course.code} /></Item.Actions>

                    <Item.Footer class="flex-wrap justify-start">
                      <span>{course.educationLevel ? primaryName(course.educationLevel) : "-"}</span>
                      <span>{course.category ? primaryName(course.category) : "-"}</span>
                      <span>{course.classType ? primaryName(course.classType) : "-"}</span>
                    </Item.Footer>
                  </a>
                {/snippet}
              </MobileListCard>
              {#if index < data.data.length - 1}
                <Item.Separator />
              {/if}
            </div>
          {/each}
        </Item.Group>
        {:else}
          {@render empty()}
        {/if}
      {/snippet}
      {#snippet desktop()}
        <Table.Root>
          <Table.Header>
            <TableControlsRow colspan={5}>{@render controls("desktop")}</TableControlsRow>
            <Table.Row>
              <Table.Head>{courseLabels.courseName}</Table.Head>
              <Table.Head>{courseLabels.courseCode}</Table.Head>
              <Table.Head><CatalogColumnFilter {...columnFilters.educationLevel} idPrefix="desktop-course-educationLevel" /></Table.Head>
              <Table.Head><CatalogColumnFilter {...columnFilters.category} idPrefix="desktop-course-category" /></Table.Head>
              <Table.Head><CatalogColumnFilter {...columnFilters.classType} idPrefix="desktop-course-classType" /></Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {#each data.data as course}
              {@const courseHref = `/catalog/courses/${course.jwId}`}
              <Table.Row class="has-[a:hover]:bg-muted/50">
                <Table.Cell class="p-0">
                  <CatalogTableLink class="font-medium" href={courseHref}>
                  <TruncatedText class="font-medium"
                      text={catalogLocalizedDisplayName(course, locale)}
                    >
                      {#snippet children()}
                        <CatalogEntityName item={course} locale={locale} />
                      {/snippet}
                    </TruncatedText>
                  </CatalogTableLink>
                </Table.Cell>

                <Table.Cell><TruncatedCode text={course.code} /></Table.Cell>
                <Table.Cell>{course.educationLevel ? primaryName(course.educationLevel) : "-"}</Table.Cell>

                <Table.Cell>
                  {course.category
                    ? catalogLocalizedDisplayName(course.category, locale)
                    : "-"}
                </Table.Cell>
              <Table.Cell>
                {course.classType ? primaryName(course.classType) : "-"}
              </Table.Cell>
              </Table.Row>
            {/each}
          {#if data.data.length === 0}
              <Table.Row><Table.Cell colspan={5}>{@render empty()}</Table.Cell></Table.Row>
            {/if}
          </Table.Body>
        </Table.Root>
      {/snippet}
    </ResponsiveCollection>
</section>
