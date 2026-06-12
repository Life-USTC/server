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
  SectionListFilters,
  SectionListLabels,
  SectionListPagination,
  SectionListRow,
  SectionListSemester,
} from "./catalog-section-list-types";

export let filters: SectionListFilters;
export let page: number;
export let pagination: SectionListPagination;
export let primaryName: (item: CatalogNamed | null | undefined) => string;
export let secondaryName: (item: CatalogNamed | null | undefined) => string;
export let sectionEmptyDescription: () => string;
export let sectionLabels: SectionListLabels;
export let sections: SectionListRow[];
export let selectedSemester: SectionListSemester | null | undefined;
export let teacherNames: (teachers: CatalogNamed[]) => string;
export let totalPages: number;

$: sectionSummaryBase = catalogShowingSummary(
  sectionLabels.showing,
  sections.length,
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

<section class="hidden min-w-0 gap-3 md:grid">
  <CatalogResultsSummary
    base={sectionSummaryBase}
    {page}
    searchText={sectionSearchSummary}
    semesterText={sectionSemesterSummary}
    {totalPages}
  />
  <div class="overflow-x-auto">
    {#if sections.length > 0}
      <Table.Root>
        <Table.Header>
          <Table.Row>
            <Table.Head class="w-32">{sectionLabels.semester}</Table.Head>
            <Table.Head>{sectionLabels.courseName}</Table.Head>
            <Table.Head class="w-28">{sectionLabels.sectionCode}</Table.Head>
            <Table.Head class="w-44">{sectionLabels.teachers}</Table.Head>
            <Table.Head class="w-16 text-right">{sectionLabels.credits}</Table.Head>
            <Table.Head class="w-24 text-right">{sectionLabels.capacity}</Table.Head>
            <Table.Head class="w-20 text-right">{sectionLabels.campus}</Table.Head>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {#each sections as section}
            {@const sectionHref = `/sections/${section.jwId}`}
            <Table.Row>
              <Table.Cell class="p-0 align-top">
                <Table.CellLink class="whitespace-nowrap px-3 py-2" href={sectionHref}>
                  {#if section.semester}
                    <span class="text-base-content/70 text-xs">{section.semester.nameCn}</span>
                  {:else}
                    <span class="text-base-content/40">-</span>
                  {/if}
                </Table.CellLink>
              </Table.Cell>
              <Table.Cell class="min-w-72 p-0 align-top">
                <Table.CellLink class="px-3 py-2 text-base-content" href={sectionHref}>
                  <span class="font-medium hover:underline">{primaryName(section.course)}</span>
                  {#if secondaryName(section.course)}
                    <span class="block text-base-content/60 text-xs">{secondaryName(section.course)}</span>
                  {/if}
                </Table.CellLink>
              </Table.Cell>
              <Table.Cell class="p-0 align-top">
                <Table.CellLink class="px-3 py-2" href={sectionHref}>
                  <Badge class="font-mono" variant="outline">{section.code}</Badge>
                </Table.CellLink>
              </Table.Cell>
              <Table.Cell class="max-w-44 truncate p-0 align-top" title={teacherNames(section.teachers) || undefined}>
                <Table.CellLink class="truncate px-3 py-2 text-base-content" href={sectionHref}>
                  {#if section.teachers.length}
                    {teacherNames(section.teachers)}
                  {:else}
                    <span class="text-base-content/40">-</span>
                  {/if}
                </Table.CellLink>
              </Table.Cell>
              <Table.Cell class="p-0 text-right align-top">
                <Table.CellLink class="px-3 py-2 text-base-content tabular-nums" href={sectionHref}>{section.credits ?? "-"}</Table.CellLink>
              </Table.Cell>
              <Table.Cell class="p-0 text-right align-top">
                <Table.CellLink class="whitespace-nowrap px-3 py-2 text-base-content tabular-nums" href={sectionHref}>
                  {section.stdCount ?? 0} / {section.limitCount ?? "-"}
                </Table.CellLink>
              </Table.Cell>
              <Table.Cell class="p-0 text-right align-top">
                <Table.CellLink class="whitespace-nowrap px-3 py-2 text-base-content" href={sectionHref}>
                  {#if section.campus}
                    {primaryName(section.campus)}
                  {:else}
                    <span class="text-base-content/40">-</span>
                  {/if}
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
          description={sectionEmptyDescription()}
          title={sectionLabels.noSectionsFound}
        />
      </div>
    {/if}
  </div>
</section>
