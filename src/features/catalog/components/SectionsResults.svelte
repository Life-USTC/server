<script lang="ts">
import {
  type CatalogNamed,
  catalogLocalizedDisplayName,
  catalogLocalizedNames,
} from "@/features/catalog/lib/catalog-list-display";
import {
  catalogShowingSummary,
  optionalCatalogFilterSummary,
} from "@/features/catalog/lib/catalog-results-summary";
import { formatSemesterName } from "@/lib/text/format-semester-name";
import { page as appPage } from "$app/stores";
import ResponsiveCollection from "$lib/components/ResponsiveCollection.svelte";
import TruncatedCode from "$lib/components/TruncatedCode.svelte";
import TruncatedText from "$lib/components/TruncatedText.svelte";
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
export let selectedSemester: SectionListSemester | null | undefined;
export let totalPages: number;

$: filters = data.filters as SectionListFilters;
$: locale = $appPage.data.locale ?? "zh-cn";
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
  ? sectionLabels.inSemester.replace(
      "{semester}",
      formatSemesterName(locale, selectedSemester.nameCn),
    )
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
    <ResponsiveCollection>
      {#snippet mobile()}
      <div data-testid="catalog-results-cards">
      <Item.Group class="gap-0" role="list">
        {#each data.data as section, index}
          {@const sectionHref = `/catalog/sections/${section.jwId}`}
          <Item.Root role="listitem" size="sm">
            {#snippet child({ props })}
              <a href={sectionHref} {...props}>
                <Item.Content>
                  <Item.Title>{catalogLocalizedDisplayName(section.course, locale)}</Item.Title>
                  <Item.Description>
                    {section.semester?.nameCn ? formatSemesterName(locale, section.semester.nameCn) : sectionLabels.noSemester}
                    · {catalogLocalizedNames(section.teachers, locale) || "-"}
                  </Item.Description>
                </Item.Content>
                <Item.Actions>
                  <TruncatedCode text={section.code} />
                </Item.Actions>
                <Item.Footer class="flex-wrap justify-start">
                  <span>{sectionLabels.credits}: {section.credits ?? "-"}</span>
                  <span>{sectionLabels.capacity}: {section.stdCount ?? 0} / {section.limitCount ?? "-"}</span>
                  <span>{section.campus ? primaryName(section.campus) : "-"}</span>
                </Item.Footer>
              </a>
            {/snippet}
          </Item.Root>
          {#if index < data.data.length - 1}
            <Item.Separator aria-hidden="true" />
          {/if}
        {/each}
      </Item.Group>
      </div>
      {/snippet}
      {#snippet desktop()}
      <div class="min-w-0 max-w-full">
      <Table.Root class="table-fixed">
        <Table.Header class="bg-muted/30">
          <Table.Row>
            <Table.Head class="w-36">{sectionLabels.semester}</Table.Head>
            <Table.Head>{sectionLabels.courseName}</Table.Head>
            <Table.Head class="w-36">{sectionLabels.sectionCode}</Table.Head>
            <Table.Head class="w-36">{sectionLabels.teachers}</Table.Head>
            <Table.Head class="w-16 text-right">{sectionLabels.credits}</Table.Head>
            <Table.Head class="w-24 text-right">{sectionLabels.capacity}</Table.Head>
            <Table.Head class="w-28">{sectionLabels.campus}</Table.Head>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {#each data.data as section}
            {@const sectionHref = `/catalog/sections/${section.jwId}`}
            <Table.Row>
              <Table.Cell class="p-0 align-top">
                <CatalogTableLink href={sectionHref} nowrap>
                  {section.semester?.nameCn
                    ? formatSemesterName(locale, section.semester.nameCn)
                    : sectionLabels.noSemester}
                </CatalogTableLink>
              </Table.Cell>
              <Table.Cell class="p-0 align-top whitespace-normal">
                <CatalogTableLink href={sectionHref}>
                  <TruncatedText
                    text={catalogLocalizedDisplayName(section.course, locale)}
                  />
                </CatalogTableLink>
              </Table.Cell>
              <Table.Cell class="p-0 align-top">
                <CatalogTableLink href={sectionHref}>
                  <TruncatedCode text={section.code} />
                </CatalogTableLink>
              </Table.Cell>
              <Table.Cell class="p-0 align-top whitespace-normal">
                <CatalogTableLink href={sectionHref}>
                  <TruncatedText
                    text={catalogLocalizedNames(section.teachers, locale) || "-"}
                  />
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
              <Table.Cell class="p-0 align-top">
                <CatalogTableLink href={sectionHref}>
                  {section.campus ? primaryName(section.campus) : "-"}
                </CatalogTableLink>
              </Table.Cell>
            </Table.Row>
          {/each}
        </Table.Body>
      </Table.Root>
      </div>
      {/snippet}
    </ResponsiveCollection>
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
