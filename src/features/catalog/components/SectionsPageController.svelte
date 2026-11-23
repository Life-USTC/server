<script lang="ts">
import CollectionPage from "#lib/components/CollectionPage.svelte";
import EndlessScroll from "#lib/components/EndlessScroll.svelte";
import SearchFilterBar from "#lib/components/SearchFilterBar.svelte";
import TableColumnHeader from "#lib/components/TableColumnHeader.svelte";
import * as Item from "#lib/components/ui/item/index.js";
import { catalogActiveFilters } from "@/features/catalog/lib/catalog-filter-view";
import {
  catalogHref,
  catalogPrimaryName as primaryName,
} from "@/features/catalog/lib/catalog-list-display";
import type { EndlessScrollState } from "@/lib/navigation/endless-list.svelte";
import type { TableFilterField } from "@/lib/table-filters";
import { formatSemesterName } from "@/lib/text/format-semester-name";
import { page as routePage } from "$app/state";
import type {
  SectionListCommonLabels,
  SectionListFilters,
  SectionListLabels,
  SectionListOptionSource,
  SectionListRow,
  SectionListSemester,
} from "./catalog-section-list-types";
import SectionsResults from "./SectionsResults.svelte";

type PageData = {
  data: SectionListRow[];
  filterOptions: {
    campuses: SectionListOptionSource[];
    categories: SectionListOptionSource[];
    classTypes: SectionListOptionSource[];
    departments: SectionListOptionSource[];
    educationLevels: SectionListOptionSource[];
    semesters: (SectionListSemester & SectionListOptionSource)[];
  };
  filters: SectionListFilters;
  labels: {
    common: SectionListCommonLabels;
    sections: SectionListLabels & { title: string };
  };
  pagination: { page: number; total: number; totalPages: number };
};
let { data, endless }: { data: PageData; endless: EndlessScrollState } =
  $props();
const locale = $derived(routePage.data.locale ?? "zh-cn");
const commonLabels = $derived(data.labels.common);
const sectionLabels = $derived(data.labels.sections);
const options = (items: SectionListOptionSource[]) =>
  items.map((item) => ({ value: String(item.id), label: primaryName(item) }));
const fields = $derived<TableFilterField[]>([
  {
    name: "semesterId",
    label: sectionLabels.semester,
    options: data.filterOptions.semesters.map((semester) => ({
      value: String(semester.id),
      label: formatSemesterName(locale, semester.nameCn),
    })),
  },
  { name: "courseName", label: sectionLabels.courseName },
  { name: "sectionCode", label: sectionLabels.sectionCode },
  { name: "teacher", label: sectionLabels.teachers },
  {
    name: "credits",
    label: sectionLabels.credits,
    type: "number",
    min: 0,
    step: "any",
  },
  {
    name: "stdCount",
    label: sectionLabels.enrolled,
    type: "number",
    min: 0,
    step: 1,
  },
  {
    name: "limitCount",
    label: sectionLabels.enrollmentLimit,
    type: "number",
    min: 0,
    step: 1,
  },
  {
    name: "campusId",
    label: sectionLabels.campus,
    options: options(data.filterOptions.campuses),
  },
  {
    name: "teacherCount",
    label: sectionLabels.teacherCount,
    type: "number",
    min: 0,
    step: 1,
  },
  { name: "courseCode", label: sectionLabels.courseCode },
  {
    name: "departmentId",
    label: sectionLabels.department,
    options: options(data.filterOptions.departments),
  },
  {
    name: "categoryId",
    label: sectionLabels.category,
    options: options(data.filterOptions.categories),
  },
  {
    name: "educationLevelId",
    label: sectionLabels.educationLevel,
    options: options(data.filterOptions.educationLevels),
  },
  {
    name: "classTypeId",
    label: sectionLabels.classType,
    options: options(data.filterOptions.classTypes),
  },
]);
const sortLabels = $derived({
  semester: sectionLabels.filters.sortSemester,
  course: sectionLabels.filters.sortCourse,
  code: sectionLabels.filters.sortCode,
  teacher: sectionLabels.filters.sortTeacherCount,
  credits: sectionLabels.filters.sortCredits,
  capacity: sectionLabels.filters.sortCapacity,
  campus: sectionLabels.filters.sortCampus,
});
const activeFilters = $derived([
  ...catalogActiveFilters(
    "/catalog/sections",
    data.filters,
    [{ name: "search", label: commonLabels.search }, ...fields],
    commonLabels.tableFilters,
  ),
  ...(data.filters.sort
    ? [
        {
          href: catalogHref("/catalog/sections", {
            ...data.filters,
            page: "",
            sort: "",
            order: "",
          }),
          label: `${sectionLabels.filters.sortBy}: ${sortLabels[data.filters.sort as keyof typeof sortLabels] ?? data.filters.sort} · ${data.filters.order === "desc" ? sectionLabels.filters.orderDesc : sectionLabels.filters.orderAsc}`,
        },
      ]
    : []),
]);
function emptyDescription() {
  return data.filters.search
    ? sectionLabels.searchFor.replace("{query}", data.filters.search)
    : sectionLabels.subtitle;
}
</script>

{#snippet paginationFooter()}
  <EndlessScroll state={endless} labels={commonLabels.endlessScroll} />
{/snippet}
{#snippet controls()}
  <SearchFilterBar
    action="/catalog/sections"
    filters={data.filters}
    {fields}
    active={activeFilters}
    groupLabel={sectionLabels.summary.filters}
    searchLabel={commonLabels.search}
    placeholder={sectionLabels.searchPlaceholder}
    clearLabel={commonLabels.clear}
    applyLabel={commonLabels.applyFilters}
    filterLabels={commonLabels.tableFilters}
    noResults={commonLabels.noMatchingOptions}
    sort={{ options: sortLabels, label: sectionLabels.filters.sortBy, defaultLabel: sectionLabels.filters.defaultSort, asc: sectionLabels.filters.orderAsc, desc: sectionLabels.filters.orderDesc }}
  />
  <TableColumnHeader label={sectionLabels.searchHelpTitle}>
      <p class="mb-3 text-sm text-muted-foreground">{sectionLabels.searchHelpDescription}</p>
      <Item.Group>
        {#each sectionLabels.searchHelpExamples as example}
          <Item.Root size="sm"><Item.Content><Item.Title class="line-clamp-none break-all"><code>{example.syntax}</code></Item.Title><Item.Description class="line-clamp-none">{example.description}</Item.Description><Item.Description class="line-clamp-none break-all"><code>{example.example}</code></Item.Description></Item.Content></Item.Root>
        {/each}
      </Item.Group>
    </TableColumnHeader>
{/snippet}
<CollectionPage description={sectionLabels.subtitle} footer={endless.hasMore ? paginationFooter : undefined} title={sectionLabels.title} toolbar={controls}>
  <SectionsResults filtered={activeFilters.length > 0} clearLabel={commonLabels.clear} rows={data.data} primaryName={primaryName} sectionEmptyDescription={emptyDescription} {sectionLabels} />
</CollectionPage>
