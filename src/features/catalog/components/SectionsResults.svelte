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
import CatalogTableLink from "./CatalogTableLink.svelte";
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
    <div class="md:hidden">
      <Item.Group>
        {#each data.data as section}
          {@const sectionHref = `/sections/${section.jwId}`}
          <Item.Root variant="outline" size="sm">
            {#snippet child({ props })}
              <a href={sectionHref} {...props}>
                <Item.Content>
                  <Item.Title>{primaryName(section.course)}</Item.Title>
                  {#if secondaryName(section.course)}
                    <Item.Description>{secondaryName(section.course)}</Item.Description>
                  {/if}
                  <Item.Description>
                    {section.semester?.nameCn ?? sectionLabels.noSemester}
                    · {teacherNames(section.teachers) || "-"}
                  </Item.Description>
                </Item.Content>
                <Item.Actions>
                  <Badge variant="outline">{section.code}</Badge>
                </Item.Actions>
                <Item.Footer class="flex-wrap justify-start">
                  <span>{sectionLabels.credits}: {section.credits ?? "-"}</span>
                  <span>{sectionLabels.capacity}: {section.stdCount ?? 0} / {section.limitCount ?? "-"}</span>
                  <span>{section.campus ? primaryName(section.campus) : "-"}</span>
                </Item.Footer>
              </a>
            {/snippet}
          </Item.Root>
        {/each}
      </Item.Group>
    </div>
    <div class="hidden min-w-0 max-w-full md:block">
      <Table.Root>
        <Table.Header>
          <Table.Row>
            <Table.Head class="w-36">{sectionLabels.semester}</Table.Head>
            <Table.Head class="min-w-72">{sectionLabels.courseName}</Table.Head>
            <Table.Head class="w-28">{sectionLabels.sectionCode}</Table.Head>
            <Table.Head class="min-w-44">{sectionLabels.teachers}</Table.Head>
            <Table.Head class="w-20 text-right">{sectionLabels.credits}</Table.Head>
            <Table.Head class="w-28 text-right">{sectionLabels.capacity}</Table.Head>
            <Table.Head class="w-28 text-right">{sectionLabels.campus}</Table.Head>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {#each data.data as section}
            {@const sectionHref = `/sections/${section.jwId}`}
            <Table.Row>
              <Table.Cell class="p-0 align-top">
                <CatalogTableLink href={sectionHref} nowrap>
                  {section.semester?.nameCn ?? sectionLabels.noSemester}
                </CatalogTableLink>
              </Table.Cell>
              <Table.Cell class="min-w-72 p-0 align-top">
                <CatalogTableLink href={sectionHref}>
                  <span class="font-medium">{primaryName(section.course)}</span>
                  {#if secondaryName(section.course)}
                    <span class="block text-muted-foreground text-xs">{secondaryName(section.course)}</span>
                  {/if}
                </CatalogTableLink>
              </Table.Cell>
              <Table.Cell class="p-0 align-top">
                <CatalogTableLink href={sectionHref}>
                  <Badge variant="outline">{section.code}</Badge>
                </CatalogTableLink>
              </Table.Cell>
              <Table.Cell class="min-w-44 p-0 align-top">
                <CatalogTableLink href={sectionHref}>
                  {teacherNames(section.teachers) || "-"}
                </CatalogTableLink>
              </Table.Cell>
              <Table.Cell class="p-0 text-right align-top">
                <CatalogTableLink href={sectionHref} numeric>
                  {section.credits ?? "-"}
                </CatalogTableLink>
              </Table.Cell>
              <Table.Cell class="p-0 text-right align-top">
                <CatalogTableLink href={sectionHref} numeric>
                  {section.stdCount ?? 0} / {section.limitCount ?? "-"}
                </CatalogTableLink>
              </Table.Cell>
              <Table.Cell class="p-0 text-right align-top">
                <CatalogTableLink href={sectionHref}>
                  {section.campus ? primaryName(section.campus) : "-"}
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
        description={sectionEmptyDescription()}
        title={sectionLabels.noSectionsFound}
      />
    </div>
  {/if}
</section>
