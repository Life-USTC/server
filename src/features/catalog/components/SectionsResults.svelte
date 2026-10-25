<script lang="ts">
import MobileListCard from "#lib/components/MobileListCard.svelte";
import ResponsiveCollection from "#lib/components/ResponsiveCollection.svelte";
import ResultsEmpty from "#lib/components/ResultsEmpty.svelte";
import TruncatedCode from "#lib/components/TruncatedCode.svelte";
import TruncatedText from "#lib/components/TruncatedText.svelte";
import * as Item from "#lib/components/ui/item/index.js";
import * as Table from "#lib/components/ui/table/index.js";
import {
  type CatalogNamed,
  catalogLocalizedDisplayName,
  catalogLocalizedNames,
} from "@/features/catalog/lib/catalog-list-display";
import { formatSemesterName } from "@/lib/text/format-semester-name";
import { page as routePage } from "$app/state";
import CatalogColumnFilter from "./CatalogColumnFilter.svelte";
import CatalogEntityName from "./CatalogEntityName.svelte";
import CatalogTableLink from "./CatalogTableLink.svelte";
import type { CatalogColumnFilterProps } from "./catalog-column-filter-types";
import type {
  SectionListFilters,
  SectionListLabels,
  SectionListResultData,
} from "./catalog-section-list-types";

interface Props {
  columnFilters: Record<string, CatalogColumnFilterProps>;
  data: SectionListResultData;
  primaryName: (item: CatalogNamed | null | undefined) => string;
  sectionEmptyDescription: () => string;
  sectionLabels: SectionListLabels;
}

let {
  columnFilters,
  data,
  primaryName,
  sectionEmptyDescription,
  sectionLabels,
}: Props = $props();

let filters = $derived(data.filters as SectionListFilters);
let locale = $derived(routePage.data.locale ?? "zh-cn");
</script>


{#snippet empty()}
    <div class="py-10">
      <ResultsEmpty
        description={sectionEmptyDescription()}
        title={sectionLabels.noSectionsFound}
      />
    </div>
{/snippet}

<section class="grid min-w-0 gap-3">
    <ResponsiveCollection>
      {#snippet mobile()}
        <div class="grid gap-3" data-slot="collection-header">
          <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
            {#each Object.entries(columnFilters) as [key, column] (key)}
              <CatalogColumnFilter {...column} idPrefix={"mobile-section-" + key} />
            {/each}
          </div>
        </div>
        {#if data.data.length > 0}
        <div data-testid="catalog-results-cards">
          <Item.Group class="gap-0" role="list">
            {#each data.data as section, index}
              {@const sectionHref = `/catalog/sections/${section.jwId}`}
              <div role="listitem">
                <MobileListCard size="sm">
                  {#snippet child({ props })}
                    <a href={sectionHref} {...props}>
                      <Item.Content>
                        <Item.Title><CatalogEntityName item={section.course} locale={locale} /></Item.Title>
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
                </MobileListCard>
              </div>
              {#if index < data.data.length - 1}
                <Item.Separator aria-hidden="true" />
              {/if}
            {/each}
          </Item.Group>
        </div>
        {:else}
          {@render empty()}
        {/if}
      {/snippet}
      {#snippet desktop()}
        <div class="min-w-0 max-w-full">
          <Table.Root class="table-fixed">
            <colgroup>
              <col class="w-36" />
              <col />
              <col class="w-36" />
              <col class="w-36" />
              <col class="w-20" />
              <col class="w-24" />
              <col class="w-28" />
            </colgroup>
            <Table.Header class="bg-muted/30">
              <Table.Row>
                <Table.Head class="w-36" aria-sort={filters.sort === "semester" ? filters.order === "desc" ? "descending" : "ascending" : undefined}><CatalogColumnFilter {...columnFilters.semester} idPrefix="desktop-section-semester" /></Table.Head>
                <Table.Head aria-sort={filters.sort === "course" ? filters.order === "desc" ? "descending" : "ascending" : undefined}><CatalogColumnFilter {...columnFilters.course} idPrefix="desktop-section-course" /></Table.Head>
                <Table.Head class="w-36" aria-sort={filters.sort === "code" ? filters.order === "desc" ? "descending" : "ascending" : undefined}><CatalogColumnFilter {...columnFilters.code} idPrefix="desktop-section-code" /></Table.Head>
                <Table.Head class="w-36" aria-sort={filters.sort === "teacher" ? filters.order === "desc" ? "descending" : "ascending" : undefined}><CatalogColumnFilter {...columnFilters.teacher} idPrefix="desktop-section-teacher" /></Table.Head>
                <Table.Head class="w-20" aria-sort={filters.sort === "credits" ? filters.order === "desc" ? "descending" : "ascending" : undefined}><CatalogColumnFilter {...columnFilters.credits} idPrefix="desktop-section-credits" /></Table.Head>
                <Table.Head class="w-24" aria-sort={filters.sort === "capacity" ? filters.order === "desc" ? "descending" : "ascending" : undefined}><CatalogColumnFilter {...columnFilters.capacity} idPrefix="desktop-section-capacity" /></Table.Head>
                <Table.Head class="w-28" aria-sort={filters.sort === "campus" ? filters.order === "desc" ? "descending" : "ascending" : undefined}><CatalogColumnFilter {...columnFilters.campus} idPrefix="desktop-section-campus" /></Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {#each data.data as section}
                {@const sectionHref = `/catalog/sections/${section.jwId}`}
                <Table.Row class="has-[a:hover]:bg-muted/50">
                  <Table.Cell class="whitespace-nowrap">
                    {section.semester?.nameCn
                      ? formatSemesterName(locale, section.semester.nameCn)
                      : sectionLabels.noSemester}
                  </Table.Cell>
                  <Table.Cell class="p-0 whitespace-normal">
                    <CatalogTableLink class="font-medium" href={sectionHref}>
                  <TruncatedText class="font-medium"
                        text={catalogLocalizedDisplayName(section.course, locale)}
                      >
                        {#snippet children()}
                          <CatalogEntityName item={section.course} locale={locale} />
                        {/snippet}
                      </TruncatedText>
                    </CatalogTableLink>
                  </Table.Cell>
              <Table.Cell >
                <TruncatedCode text={section.code} />
              </Table.Cell>
                  <Table.Cell class="whitespace-normal">
                    <TruncatedText
                      text={catalogLocalizedNames(section.teachers, locale) || "-"}
                    />
                  </Table.Cell>
              <Table.Cell class="text-left tabular-nums">
                {section.credits ?? "-"}
              </Table.Cell>
              <Table.Cell class="text-left tabular-nums">
                {section.stdCount ?? 0} / {section.limitCount ?? "-"}
              </Table.Cell>
              <Table.Cell >
                {section.campus ? primaryName(section.campus) : "-"}
              </Table.Cell>
                </Table.Row>
              {/each}
            {#if data.data.length === 0}
              <Table.Row><Table.Cell colspan={7}>{@render empty()}</Table.Cell></Table.Row>
            {/if}
          </Table.Body>
          </Table.Root>
        </div>
      {/snippet}
    </ResponsiveCollection>
</section>
