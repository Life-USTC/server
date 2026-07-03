<script lang="ts">
import type { CatalogNamed } from "@/features/catalog/lib/catalog-list-display";
import {
  catalogShowingSummary,
  optionalCatalogFilterSummary,
} from "@/features/catalog/lib/catalog-results-summary";
import { Badge } from "$lib/components/ui/badge/index.js";
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
    <div class="grid min-w-0 w-full overflow-hidden rounded-md border border-base-300">
      {#each teachers as teacher}
        {@const teacherHref = `/teachers/${teacher.id}`}
        <a
          class="grid min-w-0 w-full gap-3 border-base-300 border-b p-3 text-base-content no-underline transition-colors last:border-b-0 hover:bg-base-200/30 md:grid-cols-[minmax(12rem,1.2fr)_minmax(7rem,0.7fr)_minmax(10rem,1fr)_minmax(8rem,0.8fr)_minmax(12rem,1.2fr)_4rem] md:items-center md:gap-4"
          href={teacherHref}
        >
          <div class="grid min-w-0 gap-1">
            <span class="truncate font-medium">{primaryName(teacher)}</span>
            {#if showSecondaryNames && secondaryName(teacher)}
              <span class="truncate text-base-content/60 text-xs">({secondaryName(teacher)})</span>
            {/if}
          </div>
          <div class="flex items-center justify-between gap-3 text-sm md:block">
            <span class="text-base-content/55 md:sr-only">{teacherLabels.code}</span>
            {#if teacher.code}
              <Badge class="w-fit font-mono" variant="outline">{teacher.code}</Badge>
            {:else}
              <span>-</span>
            {/if}
          </div>
          <div class="flex items-center justify-between gap-3 text-sm md:block">
            <span class="text-base-content/55 md:sr-only">{teacherLabels.department}</span>
            <span class="truncate">
              {teacher.department ? primaryName(teacher.department) : teacherLabels.noDepartment}
            </span>
          </div>
          <div class="flex items-center justify-between gap-3 text-sm md:block">
            <span class="text-base-content/55 md:sr-only">{teacherLabels.title_label}</span>
            <span class="truncate">
              {teacher.teacherTitle ? primaryName(teacher.teacherTitle) : commonLabels.unknown}
            </span>
          </div>
          <div class="flex items-center justify-between gap-3 text-sm md:block">
            <span class="text-base-content/55 md:sr-only">{teacherLabels.email}</span>
            <span class="truncate">{teacher.email ?? "-"}</span>
          </div>
          <div class="flex items-center justify-between gap-3 text-sm md:block md:text-right">
            <span class="text-base-content/55 md:sr-only">{teacherLabels.sections}</span>
            <Badge class="w-fit md:ml-auto" variant="outline">{teacher._count.sections}</Badge>
          </div>
        </a>
      {/each}
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
