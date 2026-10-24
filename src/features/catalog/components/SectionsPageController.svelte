<script lang="ts">
import CollectionPage from "#lib/components/CollectionPage.svelte";
import ListPagination from "#lib/components/ListPagination.svelte";
import TableColumnHeader from "#lib/components/TableColumnHeader.svelte";
import * as Item from "#lib/components/ui/item/index.js";
import {
  catalogActiveFilters,
  catalogFilterDraft,
} from "@/features/catalog/lib/catalog-filter-view";
import {
  catalogHref,
  catalogPrimaryName as primaryName,
} from "@/features/catalog/lib/catalog-list-display";
import { catalogListPageHref } from "@/features/catalog/lib/catalog-list-query";
import type { TableFilterField } from "@/lib/table-filters";
import { formatSemesterName } from "@/lib/text/format-semester-name";
import { page as routePage } from "$app/state";
import CatalogColumnFilter from "./CatalogColumnFilter.svelte";
import CatalogFilters from "./CatalogFilters.svelte";
import type { CatalogColumnFilterProps } from "./catalog-column-filter-types";
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
let { data }: { data: PageData } = $props();
const formId = "section-filters";
let draft = $derived(catalogFilterDraft(data.filters));
const locale = $derived(routePage.data.locale ?? "zh-cn");
const commonLabels = $derived(data.labels.common);
const sectionLabels = $derived(data.labels.sections);
const totalPages = $derived(data.pagination.totalPages);
const selectedSemester = $derived(
  data.filterOptions.semesters.find(
    (semester) => data.filters.semesterId === String(semester.id),
  ),
);
function update(patch: Record<string, string>) {
  draft = { ...draft, ...patch };
}
function pageHref(targetPage: number) {
  return catalogListPageHref(new URL(routePage.url.href), targetPage);
}
const options = (items: SectionListOptionSource[]) =>
  items.map((item) => ({ value: String(item.id), label: primaryName(item) }));
const fields = $derived<Record<string, TableFilterField[]>>({
  semester: [
    {
      name: "semesterId",
      label: sectionLabels.semester,
      options: data.filterOptions.semesters.map((semester) => ({
        value: String(semester.id),
        label: formatSemesterName(locale, semester.nameCn),
      })),
    },
  ],
  course: [{ name: "courseName", label: sectionLabels.courseName }],
  code: [{ name: "sectionCode", label: sectionLabels.sectionCode }],
  teacher: [{ name: "teacher", label: sectionLabels.teachers }],
  credits: [
    {
      name: "credits",
      label: sectionLabels.credits,
      type: "number",
      min: 0,
      step: "any",
    },
  ],
  capacity: [
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
  ],
  campus: [
    {
      name: "campusId",
      label: sectionLabels.campus,
      options: options(data.filterOptions.campuses),
    },
  ],
});
const extraFields = $derived<TableFilterField[]>([
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
const columnLabels = $derived({
  semester: sectionLabels.semester,
  course: sectionLabels.courseName,
  code: sectionLabels.sectionCode,
  teacher: sectionLabels.teachers,
  credits: sectionLabels.credits,
  capacity: sectionLabels.capacity,
  campus: sectionLabels.campus,
});
const sortLabels = $derived({
  semester: sectionLabels.filters.sortSemester,
  course: sectionLabels.filters.sortCourse,
  code: sectionLabels.filters.sortCode,
  teacher: sectionLabels.filters.sortTeacherCount,
  credits: sectionLabels.filters.sortCredits,
  capacity: sectionLabels.filters.sortCapacity,
  campus: sectionLabels.filters.sortCampus,
});
const defaults = $derived({
  values: draft,
  onchange: update,
  labels: commonLabels.tableFilters,
  formId,
});
const columnFilters = $derived<Record<string, CatalogColumnFilterProps>>(
  Object.fromEntries(
    Object.entries(fields).map(([key, columnFields]) => [
      key,
      {
        ...defaults,
        label: columnLabels[key as keyof typeof columnLabels],
        fields: columnFields,
        align: key === "credits" || key === "capacity" ? "end" : "start",
        sorting: {
          key,
          label: sortLabels[key as keyof typeof sortLabels],
          ascending: sectionLabels.filters.orderAsc,
          descending: sectionLabels.filters.orderDesc,
          default: sectionLabels.filters.defaultSort,
        },
      },
    ]),
  ),
);
const activeFilters = $derived([
  ...catalogActiveFilters(
    "/catalog/sections",
    data.filters,
    [
      { name: "search", label: commonLabels.search },
      ...Object.values(fields).flat(),
      ...extraFields,
    ],
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
const resultData = $derived({
  data: data.data,
  filters: data.filters,
  pagination: { total: data.pagination.total },
});
function emptyDescription() {
  return data.filters.search
    ? sectionLabels.searchFor.replace("{query}", data.filters.search)
    : sectionLabels.subtitle;
}
</script>

{#snippet paginationFooter()}
  <ListPagination ariaLabel={commonLabels.pagination} class="py-0" nextLabel={commonLabels.next} nextPageLabel={commonLabels.nextPage} page={data.pagination.page} {pageHref} previousLabel={commonLabels.previous} previousPageLabel={commonLabels.previousPage} {totalPages} />
{/snippet}
{#snippet controls()}
  <CatalogFilters {activeFilters} clearHref="/catalog/sections" clearLabel={commonLabels.clear} filterTitle={sectionLabels.summary.filters} searchLabel={commonLabels.search} searchPlaceholder={sectionLabels.searchPlaceholder} values={draft} onchange={update} applyLabel={commonLabels.applyFilters} {formId}>
    {#each extraFields as field (field.name)}<CatalogColumnFilter {...defaults} label={field.label} fields={[field]} idPrefix={"section-extra-" + field.name} />{/each}
    <TableColumnHeader label={sectionLabels.searchHelpTitle}>
      <p class="mb-3 text-sm text-muted-foreground">{sectionLabels.searchHelpDescription}</p>
      <Item.Group>
        {#each sectionLabels.searchHelpExamples as example}
          <Item.Root size="sm"><Item.Content><Item.Title class="line-clamp-none break-all"><code>{example.syntax}</code></Item.Title><Item.Description class="line-clamp-none">{example.description}</Item.Description><Item.Description class="line-clamp-none break-all"><code>{example.example}</code></Item.Description></Item.Content></Item.Root>
        {/each}
      </Item.Group>
    </TableColumnHeader>
  </CatalogFilters>
{/snippet}
<CollectionPage description={sectionLabels.subtitle} footer={totalPages > 1 ? paginationFooter : undefined} title={sectionLabels.title} toolbar={controls}>
  <SectionsResults {columnFilters} data={resultData} page={data.pagination.page} primaryName={primaryName} sectionEmptyDescription={emptyDescription} {sectionLabels} {selectedSemester} {totalPages} />
</CollectionPage>
