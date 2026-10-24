<script lang="ts">
import type { Snippet } from "svelte";
import MobileListCard from "#lib/components/MobileListCard.svelte";
import ResponsiveCollection from "#lib/components/ResponsiveCollection.svelte";
import ResultsEmpty from "#lib/components/ResultsEmpty.svelte";
import ResultsSummary from "#lib/components/ResultsSummary.svelte";
import TableControlsRow from "#lib/components/TableControlsRow.svelte";
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
  TeacherListCommonLabels,
  TeacherListFilters,
  TeacherListLabels,
  TeacherListRow,
} from "./catalog-teacher-list-types";

interface Props {
  controls: Snippet<[string]>;
  columnFilters: Record<string, CatalogColumnFilterProps>;
  commonLabels: TeacherListCommonLabels;
  filters: TeacherListFilters;
  page: number;
  primaryName: (item: CatalogNamed | null | undefined) => string;
  selectedDepartment: CatalogNamed | null | undefined;
  teacherLabels: TeacherListLabels;
  teachers: TeacherListRow[];
  total: number;
  totalPages: number;
}

let {
  controls,
  columnFilters,
  commonLabels,
  filters,
  page,
  primaryName,
  selectedDepartment,
  teacherLabels,
  teachers,
  total,
  totalPages,
}: Props = $props();

let locale = $derived(routePage.data.locale ?? "zh-cn");
let teacherSummaryBase = $derived(
  catalogShowingSummary(
    total === 1 ? teacherLabels.showingOne : teacherLabels.showing,
    teachers.length,
    total,
  ),
);
let teacherSearchSummary = $derived(
  optionalCatalogFilterSummary(
    filters.search,
    teacherLabels.searchFor,
    "{query}",
  ),
);
let teacherDepartmentSummary = $derived(
  selectedDepartment
    ? teacherLabels.inDepartment.replace(
        "{department}",
        primaryName(selectedDepartment),
      )
    : "",
);
/** Hide columns that are entirely empty or unknown on the current page. */
let showTitleColumn = $derived(
  teachers.some((teacher) => Boolean(teacher.teacherTitle)),
);
let showEmailColumn = $derived(
  teachers.some((teacher) => Boolean(teacher.email)),
);

function teacherSectionsHref(teacher: TeacherListRow) {
  return `/catalog/teachers/${teacher.id}#sections`;
}
</script>


{#snippet empty()}
    <div class="py-10">
      <ResultsEmpty
        description={teacherLabels.emptyDescription}
        title={teacherLabels.noTeachersFound}
      />
    </div>
{/snippet}

<section class="grid min-w-0 gap-3">
  <ResultsSummary
    summary={[
      teacherSummaryBase,
      teacherSearchSummary,
      teacherDepartmentSummary
    ].filter(Boolean).join(" ")}
    page={page}
    totalPages={totalPages}
  />
    <ResponsiveCollection>
      {#snippet mobile()}
        <div class="grid gap-3" data-slot="collection-header">
          {@render controls("mobile")}
          <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
            {#each Object.entries(columnFilters) as [key, column] (key)}
              <CatalogColumnFilter {...column} align="start" idPrefix={"mobile-teacher-" + key} />
            {/each}
          </div>
        </div>
        {#if teachers.length > 0}
        <Item.Group class="gap-0" role="list">
          {#each teachers as teacher, index}
            {@const teacherHref = `/catalog/teachers/${teacher.id}`}
            {@const sectionCount = teacher._count.sections}
            <div role="listitem" class="relative">
              <MobileListCard size="sm">
                {#snippet child({ props })}
                  <a href={teacherHref} {...props}>
                    <Item.Content><Item.Title><CatalogEntityName item={teacher} locale={locale} /></Item.Title></Item.Content>
                    <Item.Actions>
                      {#if sectionCount > 0}
                        <span
                          class="invisible min-w-11 tabular-nums text-sm"
                          aria-hidden="true"
                        >{sectionCount}</span>
                      {:else}
                        <span class="tabular-nums text-muted-foreground text-sm" data-testid="teacher-section-count">0</span>
                      {/if}
                    </Item.Actions>

                    <Item.Footer
                      class="flex-wrap justify-start gap-x-3 gap-y-1 text-sm"
                    >
                      {#if teacher.code}
                        <span class="font-mono text-muted-foreground">{teacher.code}</span>
                      {/if}
                    <span>{teacher.department ? primaryName(teacher.department) : teacherLabels.noDepartment}</span>
                    {#if showTitleColumn}
                      <span>{teacher.teacherTitle ? primaryName(teacher.teacherTitle) : commonLabels.unknown}</span>
                    {/if}
                      {#if showEmailColumn}
                        <span>{teacher.email ?? "-"}</span>
                      {/if}
                    </Item.Footer>
                  </a>
                {/snippet}
              </MobileListCard>
              {#if sectionCount > 0}
                <a
                  href={teacherSectionsHref(teacher)}
                  class="absolute right-3 top-0 flex min-h-11 min-w-11 items-center justify-end text-sm tabular-nums text-muted-foreground underline-offset-2 hover:underline"
                  data-testid="teacher-section-count"
                >{sectionCount}</a>
              {/if}
            </div>
            {#if index < teachers.length - 1}
              <Item.Separator aria-hidden="true" />
            {/if}
          {/each}
        </Item.Group>
        {:else}
          {@render empty()}
        {/if}
      {/snippet}
      {#snippet desktop()}
        <Table.Root class="">
          <Table.Header>
            <TableControlsRow colspan={4 + Number(showTitleColumn) + Number(showEmailColumn)}>{@render controls("desktop")}</TableControlsRow>
            <Table.Row>
              <Table.Head>{teacherLabels.name}</Table.Head>
              <Table.Head>{teacherLabels.code}</Table.Head>
              <Table.Head><CatalogColumnFilter {...columnFilters.department} idPrefix="desktop-teacher-department" /></Table.Head>
              {#if showTitleColumn}
                <Table.Head>{teacherLabels.title_label}</Table.Head>
              {/if}
              {#if showEmailColumn}
                <Table.Head>{teacherLabels.email}</Table.Head>
              {/if}
              <Table.Head class="text-right">{teacherLabels.sections}</Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {#each teachers as teacher}
              {@const teacherHref = `/catalog/teachers/${teacher.id}`}
              {@const sectionCount = teacher._count.sections}
              <Table.Row class="has-[a:hover]:bg-muted/50">
                <Table.Cell class="p-0">
                  <CatalogTableLink class="font-medium" href={teacherHref}>
                  <TruncatedText class="font-medium"
                      text={catalogLocalizedDisplayName(teacher, locale)}
                    >
                      {#snippet children()}
                        <CatalogEntityName item={teacher} locale={locale} />
                      {/snippet}
                    </TruncatedText>
                  </CatalogTableLink>
                </Table.Cell>
              <Table.Cell class="whitespace-nowrap font-mono">
                {teacher.code || "-"}
              </Table.Cell>
                <Table.Cell>
                  <TruncatedText
                    text={teacher.department
                      ? primaryName(teacher.department)
                      : teacherLabels.noDepartment}
                  />
                </Table.Cell>
                {#if showTitleColumn}
                  <Table.Cell>
                    {teacher.teacherTitle
                      ? primaryName(teacher.teacherTitle)
                      : commonLabels.unknown}
                  </Table.Cell>
                {/if}
              {#if showEmailColumn}
                <Table.Cell>
                  <TruncatedText text={teacher.email ?? "-"} />
                </Table.Cell>
              {/if}
              <Table.Cell class="p-0 whitespace-nowrap text-right tabular-nums">
                {#if sectionCount > 0}
                  <CatalogTableLink
                    class="tabular-nums"
                    href={teacherSectionsHref(teacher)}
                    numeric
                  >
                    <span data-testid="teacher-section-count">{sectionCount}</span>
                  </CatalogTableLink>
                {:else}
                  <span
                    class="flex h-full min-h-12 min-w-0 w-full items-center justify-end px-3 tabular-nums"
                    data-testid="teacher-section-count"
                  >0</span>
                {/if}
              </Table.Cell>
              </Table.Row>
            {/each}
          {#if teachers.length === 0}
              <Table.Row><Table.Cell colspan={4 + Number(showTitleColumn) + Number(showEmailColumn)}>{@render empty()}</Table.Cell></Table.Row>
            {/if}
          </Table.Body>
        </Table.Root>
      {/snippet}
    </ResponsiveCollection>
</section>
