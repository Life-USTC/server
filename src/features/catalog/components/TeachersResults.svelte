<script lang="ts">
import type { CatalogNamed } from "@/features/catalog/lib/catalog-list-display";
import {
  catalogShowingSummary,
  optionalCatalogFilterSummary,
} from "@/features/catalog/lib/catalog-results-summary";
import TruncatedText from "$lib/components/TruncatedText.svelte";
import { Badge } from "$lib/components/ui/badge/index.js";
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
export let secondaryName: (item: CatalogNamed | null | undefined) => string;
export let selectedDepartment: CatalogNamed | null | undefined;
export let showSecondaryNames: boolean;
export let teacherLabels: TeacherListLabels;
export let teachers: TeacherListRow[];
export let total: number;
export let totalPages: number;

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
    <div class="xl:hidden">
      <Item.Group>
        {#each teachers as teacher}
          {@const teacherHref = `/catalog/teachers/${teacher.id}`}
          <Item.Root variant="outline" size="sm">
            {#snippet child({ props })}
              <a href={teacherHref} {...props}>
                <Item.Content>
                  <Item.Title>{primaryName(teacher)}</Item.Title>
                  {#if showSecondaryNames && secondaryName(teacher)}
                    <Item.Description>({secondaryName(teacher)})</Item.Description>
                  {/if}
                </Item.Content>
                <Item.Actions>
                  <Badge variant="outline">{teacher._count.sections}</Badge>
                </Item.Actions>
                <Item.Footer class="flex-wrap justify-start">
                  {#if teacher.code}
                    <Badge variant="outline">{teacher.code}</Badge>
                  {/if}
                  <span>{teacher.department ? primaryName(teacher.department) : teacherLabels.noDepartment}</span>
                  <span>{teacher.teacherTitle ? primaryName(teacher.teacherTitle) : commonLabels.unknown}</span>
                  <span>{teacher.email ?? "-"}</span>
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
            <Table.Head class="min-w-56">{teacherLabels.name}</Table.Head>
            <Table.Head class="w-28">{teacherLabels.code}</Table.Head>
            <Table.Head class="min-w-44">{teacherLabels.department}</Table.Head>
            <Table.Head class="w-36">{teacherLabels.title_label}</Table.Head>
            <Table.Head class="min-w-56">{teacherLabels.email}</Table.Head>
            <Table.Head class="w-24 text-right">{teacherLabels.sections}</Table.Head>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {#each teachers as teacher}
            {@const teacherHref = `/catalog/teachers/${teacher.id}`}
            <Table.Row>
              <Table.Cell class="min-w-56 p-0 align-top">
                <CatalogTableLink href={teacherHref}>
                  <TruncatedText
                    class="font-medium"
                    text={primaryName(teacher)}
                  />
                  <TruncatedText
                    class="text-muted-foreground text-xs"
                    text={showSecondaryNames && secondaryName(teacher)
                      ? `(${secondaryName(teacher)})`
                      : null}
                  />
                </CatalogTableLink>
              </Table.Cell>
              <Table.Cell class="p-0 align-top">
                <CatalogTableLink href={teacherHref}>
                  {#if teacher.code}
                    <Badge variant="outline">{teacher.code}</Badge>
                  {:else}
                    -
                  {/if}
                </CatalogTableLink>
              </Table.Cell>
              <Table.Cell class="min-w-44 p-0 align-top">
                <CatalogTableLink href={teacherHref}>
                  <TruncatedText
                    text={teacher.department
                      ? primaryName(teacher.department)
                      : teacherLabels.noDepartment}
                  />
                </CatalogTableLink>
              </Table.Cell>
              <Table.Cell class="p-0 align-top">
                <CatalogTableLink href={teacherHref}>
                  <TruncatedText
                    text={teacher.teacherTitle
                      ? primaryName(teacher.teacherTitle)
                      : commonLabels.unknown}
                  />
                </CatalogTableLink>
              </Table.Cell>
              <Table.Cell class="min-w-56 p-0 align-top">
                <CatalogTableLink href={teacherHref}>
                  <TruncatedText text={teacher.email ?? "-"} />
                </CatalogTableLink>
              </Table.Cell>
              <Table.Cell class="p-0 text-right align-top">
                <CatalogTableLink href={teacherHref}>
                  <Badge variant="outline">{teacher._count.sections}</Badge>
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
        description={teacherLabels.emptyDescription}
        title={teacherLabels.noTeachersFound}
      />
    </div>
  {/if}
</section>
