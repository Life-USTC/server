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
import ResponsiveCollection from "$lib/components/ResponsiveCollection.svelte";
import TruncatedText from "$lib/components/TruncatedText.svelte";
import * as Item from "$lib/components/ui/item/index.js";
import * as Table from "$lib/components/ui/table/index.js";
import CatalogResultsEmpty from "./CatalogResultsEmpty.svelte";
import CatalogResultsSummary from "./CatalogResultsSummary.svelte";
import CatalogTableLink from "./CatalogTableLink.svelte";
import type {
  TeacherListCommonLabels,
  TeacherListFilters,
  TeacherListLabels,
  TeacherListRow,
} from "./catalog-teacher-list-types";

export let commonLabels: TeacherListCommonLabels;
export let filters: TeacherListFilters;
export let page: number;
export let primaryName: (item: CatalogNamed | null | undefined) => string;
export let selectedDepartment: CatalogNamed | null | undefined;
export let teacherLabels: TeacherListLabels;
export let teachers: TeacherListRow[];
export let total: number;
export let totalPages: number;

$: locale = $appPage.data.locale ?? "zh-cn";
$: teacherSummaryBase = catalogShowingSummary(
  teacherLabels.showing,
  teachers.length,
  total,
);
$: teacherSearchSummary = optionalCatalogFilterSummary(
  filters.search,
  teacherLabels.searchFor,
  "{query}",
);
$: teacherDepartmentSummary = selectedDepartment
  ? teacherLabels.inDepartment.replace(
      "{department}",
      primaryName(selectedDepartment),
    )
  : "";
$: pageLabel = teacherLabels.pageOf
  .replace("{page}", String(page))
  .replace("{totalPages}", String(totalPages));
</script>

<section class="grid min-w-0 gap-3">
  <CatalogResultsSummary
    base={teacherSummaryBase}
    {page}
    {pageLabel}
    searchText={teacherSearchSummary}
    semesterText={teacherDepartmentSummary}
    {totalPages}
  />
  {#if teachers.length > 0}
    <ResponsiveCollection>
      {#snippet mobile()}
      <Item.Group class="gap-0" role="list">
        {#each teachers as teacher, index}
          {@const teacherHref = `/catalog/teachers/${teacher.id}`}
          <Item.Root role="listitem" size="sm">
            {#snippet child({ props })}
              <a href={teacherHref} {...props}>
                <Item.Content>
                  <Item.Title>{catalogLocalizedDisplayName(teacher, locale)}</Item.Title>
                </Item.Content>
                <Item.Actions>
                  <span class="tabular-nums text-muted-foreground text-sm"
                    >{teacher._count.sections}</span
                  >
                </Item.Actions>
                <Item.Footer class="flex-wrap justify-start gap-x-3 gap-y-1 text-sm">
                  {#if teacher.code}
                    <span class="font-mono text-muted-foreground">{teacher.code}</span>
                  {/if}
                  <span>{teacher.department ? primaryName(teacher.department) : teacherLabels.noDepartment}</span>
                  <span>{teacher.teacherTitle ? primaryName(teacher.teacherTitle) : commonLabels.unknown}</span>
                  <span>{teacher.email ?? "-"}</span>
                </Item.Footer>
              </a>
            {/snippet}
          </Item.Root>
          {#if index < teachers.length - 1}
            <Item.Separator aria-hidden="true" />
          {/if}
        {/each}
      </Item.Group>
      {/snippet}
      {#snippet desktop()}
      <Table.Root class="">
        <Table.Header>
          <Table.Row>
            <Table.Head>{teacherLabels.name}</Table.Head>
            <Table.Head>{teacherLabels.code}</Table.Head>
            <Table.Head>{teacherLabels.department}</Table.Head>
            <Table.Head>{teacherLabels.title_label}</Table.Head>
            <Table.Head>{teacherLabels.email}</Table.Head>
            <Table.Head>{teacherLabels.sections}</Table.Head>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {#each teachers as teacher}
            {@const teacherHref = `/catalog/teachers/${teacher.id}`}
            <Table.Row class="has-[a:hover]:bg-muted/50">
              <Table.Cell class="p-0">
                <CatalogTableLink href={teacherHref}>
                  <TruncatedText
                    text={catalogLocalizedDisplayName(teacher, locale)}
                  />
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
              <Table.Cell>
                {teacher.teacherTitle
                  ? primaryName(teacher.teacherTitle)
                  : commonLabels.unknown}
              </Table.Cell>
              <Table.Cell>
                <TruncatedText text={teacher.email ?? "-"} />
              </Table.Cell>
              <Table.Cell class="whitespace-nowrap text-right tabular-nums">
                {teacher._count.sections}
              </Table.Cell>
            </Table.Row>
          {/each}
        </Table.Body>
      </Table.Root>
      {/snippet}
    </ResponsiveCollection>
  {:else}
    <div class="py-10">
      <CatalogResultsEmpty
        centered
        description={teacherLabels.emptyDescription}
        title={teacherLabels.noTeachersFound}
      />
    </div>
  {/if}
</section>
