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

<section class="hidden min-w-0 gap-3 md:grid">
  <CatalogResultsSummary
    base={teacherSummaryBase}
    {page}
    {pageLabel}
    searchText={teacherSearchSummary}
    semesterText={teacherDepartmentSummary}
    totalPages={totalPages}
  />
  <div class="overflow-x-auto">
    {#if teachers.length > 0}
      <Table.Root>
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
            {@const teacherHref = `/teachers/${teacher.id}`}
            <Table.Row>
              <Table.Cell class="min-w-64 p-0">
                <Table.CellLink class="text-base-content" href={teacherHref}>
                  <span class="font-medium hover:underline">{primaryName(teacher)}</span>
                  {#if showSecondaryNames && secondaryName(teacher)}
                    <span class="ml-2 text-base-content/60 text-xs">({secondaryName(teacher)})</span>
                  {/if}
                </Table.CellLink>
              </Table.Cell>
              <Table.Cell class="p-0">
                <Table.CellLink href={teacherHref}>
                  {#if teacher.code}
                    <Badge class="font-mono" variant="outline">{teacher.code}</Badge>
                  {:else}
                    <span class="text-base-content/40">-</span>
                  {/if}
                </Table.CellLink>
              </Table.Cell>
              <Table.Cell class="p-0">
                <Table.CellLink href={teacherHref}>
                  {#if teacher.department}<Badge variant="ghost">{primaryName(teacher.department)}</Badge>{:else}<span class="text-base-content/40">{teacherLabels.noDepartment}</span>{/if}
                </Table.CellLink>
              </Table.Cell>
              <Table.Cell class="p-0">
                <Table.CellLink class="text-base-content" href={teacherHref}>
                  {teacher.teacherTitle ? primaryName(teacher.teacherTitle) : commonLabels.unknown}
                </Table.CellLink>
              </Table.Cell>
              <Table.Cell class="p-0">
                <Table.CellLink class="text-base-content" href={teacherHref}>
                  {#if teacher.email}<span class="text-sm">{teacher.email}</span>{:else}<span class="text-base-content/40">-</span>{/if}
                </Table.CellLink>
              </Table.Cell>
              <Table.Cell class="p-0">
                <Table.CellLink href={teacherHref}>
                  <Badge variant="outline">{teacher._count.sections}</Badge>
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
          description={teacherLabels.emptyDescription}
          title={teacherLabels.noTeachersFound}
        />
      </div>
    {/if}
  </div>
</section>
