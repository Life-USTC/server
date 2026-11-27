<script lang="ts">
import MobileListCard from "#lib/components/MobileListCard.svelte";
import TruncatedCode from "#lib/components/TruncatedCode.svelte";
import TruncatedText from "#lib/components/TruncatedText.svelte";
import * as Item from "#lib/components/ui/item/index.js";
import Table from "#lib/components/ui/table/table.svelte";
import {
  catalogLocalizedNames,
  catalogPrimaryName as primaryName,
} from "@/features/catalog/lib/catalog-list-display";
import { formatSemesterName } from "@/lib/text/format-semester-name";
import { page as routePage } from "$app/state";
import CatalogColumnFilter from "./CatalogColumnFilter.svelte";
import CatalogResults from "./CatalogResults.svelte";
import CatalogTableLink from "./CatalogTableLink.svelte";
import type { CatalogColumnFilterProps } from "./catalog-column-filters";
import type {
  SectionListFilters,
  SectionListLabels,
  SectionListRow,
} from "./catalog-section-list-types";

interface Props {
  columnFilters: Record<string, CatalogColumnFilterProps>;
  rows: SectionListRow[];
  filters: SectionListFilters;
  description: string;
  sectionLabels: SectionListLabels;
}

let { columnFilters, rows, filters, description, sectionLabels }: Props =
  $props();

let locale = $derived(routePage.data.locale ?? "zh-cn");
function sortDirection(key: string) {
  if (filters.sort === key)
    return filters.order === "desc" ? "descending" : "ascending";
}
</script>

<CatalogResults {rows} filters={columnFilters} prefix="mobile-section-" testId="catalog-results-cards" title={sectionLabels.noSectionsFound} {description}>
  {#snippet card(section)}
    {@const sectionHref = `/catalog/sections/${section.jwId}`}
    <MobileListCard href={sectionHref}>
      <Item.Content>
        <Item.Title class="block w-full line-clamp-none break-words text-base">{primaryName(section.course) || section.code}</Item.Title>
        <Item.Description class="line-clamp-none">{catalogLocalizedNames(section.teachers, locale)}</Item.Description>
        <span class="text-xs text-muted-foreground">{section.semester?.nameCn ? formatSemesterName(locale, section.semester.nameCn) : sectionLabels.noSemester}</span>
        <span class="font-mono text-xs text-muted-foreground" data-slot="catalog-code">{section.code}</span>
      </Item.Content>
      <Item.Footer class="flex-wrap justify-start">
        <span>{sectionLabels.credits}: {section.credits ?? "-"}</span>
        <span>{sectionLabels.capacity}: {section.stdCount ?? (routePage.data.demo ? "-" : 0)} / {section.limitCount ?? "-"}</span>
        <span>{section.campus ? primaryName(section.campus) : "-"}</span>
      </Item.Footer>
    </MobileListCard>
  {/snippet}
  {#snippet table(empty)}
    <div class="min-w-0 max-w-full">
      <Table class="table-fixed">
        <colgroup>
          <col class="w-36" />
          <col />
          <col class="w-36" />
          <col class="w-36" />
          <col class="w-20" />
          <col class="w-24" />
          <col class="w-28" />
        </colgroup>
        <thead class="bg-muted/30">
          <tr>
            <th class="w-36" aria-sort={sortDirection("semester")}><CatalogColumnFilter {...columnFilters.semester} idPrefix="desktop-section-semester" /></th>
            <th class="pl-8" aria-sort={sortDirection("course")}><CatalogColumnFilter {...columnFilters.course} idPrefix="desktop-section-course" /></th>
            <th class="w-36" aria-sort={sortDirection("code")}><CatalogColumnFilter {...columnFilters.code} idPrefix="desktop-section-code" /></th>
            <th class="w-36" aria-sort={sortDirection("teacher")}><CatalogColumnFilter {...columnFilters.teacher} idPrefix="desktop-section-teacher" /></th>
            <th class="w-20" aria-sort={sortDirection("credits")}><CatalogColumnFilter {...columnFilters.credits} idPrefix="desktop-section-credits" /></th>
            <th class="w-24" aria-sort={sortDirection("capacity")}><CatalogColumnFilter {...columnFilters.capacity} idPrefix="desktop-section-capacity" /></th>
            <th class="w-28" aria-sort={sortDirection("campus")}><CatalogColumnFilter {...columnFilters.campus} idPrefix="desktop-section-campus" /></th>
          </tr>
        </thead>
        <tbody>
          {#each rows as section}
            {@const sectionHref = `/catalog/sections/${section.jwId}`}
            <tr>
              <td class="whitespace-nowrap">
                {section.semester?.nameCn
                  ? formatSemesterName(locale, section.semester.nameCn)
                  : sectionLabels.noSemester}
              </td>
              <td class="p-0 whitespace-normal">
                <CatalogTableLink class="font-medium" href={sectionHref}>
                  <span class="break-words text-base">{primaryName(section.course) || section.code}</span>
                </CatalogTableLink>
              </td>
          <td >
            <TruncatedCode text={section.code} />
          </td>
              <td class="whitespace-normal">
                <TruncatedText
                  text={catalogLocalizedNames(section.teachers, locale) || "-"}
                />
              </td>
          <td class="text-left tabular-nums">
            {section.credits ?? "-"}
          </td>
          <td class="text-left tabular-nums">
            {section.stdCount ?? (routePage.data.demo ? "-" : 0)} / {section.limitCount ?? "-"}
          </td>
          <td >
            {section.campus ? primaryName(section.campus) : "-"}
          </td>
            </tr>
          {/each}
        {#if rows.length === 0}
          <tr><td colspan={7}>{@render empty()}</td></tr>
        {/if}
      </tbody>
      </Table>
    </div>
  {/snippet}
</CatalogResults>
