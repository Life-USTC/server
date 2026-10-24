<script lang="ts">
import CollectionPage from "#lib/components/CollectionPage.svelte";
import ListPagination from "#lib/components/ListPagination.svelte";
import TableColumnHeader from "#lib/components/TableColumnHeader.svelte";
import * as Item from "#lib/components/ui/item/index.js";
import {
  catalogHref,
  catalogPrimaryName as primaryName,
} from "@/features/catalog/lib/catalog-list-display";
import { catalogListPageHref } from "@/features/catalog/lib/catalog-list-query";
import { formatSemesterName } from "@/lib/text/format-semester-name";
import { page as routePage } from "$app/state";
import CatalogColumnFilter from "./CatalogColumnFilter.svelte";
import CatalogFilters from "./CatalogFilters.svelte";
import type { CatalogColumnFilterProps } from "./catalog-column-filter-types";
import type {
  SectionListCommonLabels,
  SectionListFilters,
  SectionListLabels,
  SectionListOption,
  SectionListOptionSource,
  SectionListRow,
  SectionListSemester,
} from "./catalog-section-list-types";
import SectionsResults from "./SectionsResults.svelte";

type SemesterOption = SectionListSemester & SectionListOptionSource;
type PageData = {
  data: SectionListRow[];
  filterOptions: {
    campuses: SectionListOptionSource[];
    categories: SectionListOptionSource[];
    classTypes: SectionListOptionSource[];
    departments: SectionListOptionSource[];
    educationLevels: SectionListOptionSource[];
    semesters: SemesterOption[];
  };
  filters: SectionListFilters;
  labels: {
    common: SectionListCommonLabels & {
      allSemesters: string;
      home: string;
      loading: string;
      sections: string;
    };
    sections: SectionListLabels & { title: string };
  };
  pagination: { page: number; total: number; totalPages: number };
};

interface Props {
  data: PageData;
}

let { data }: Props = $props();

let sectionSearch = $derived(data.filters.search ?? "");

function pageHref(targetPage: number) {
  return catalogListPageHref(new URL(routePage.url.href), targetPage);
}

function sectionFilterHref(overrides: Partial<SectionListFilters>) {
  return catalogHref(
    "/catalog/sections",
    sectionFilterParams({ ...data.filters, ...overrides }),
  );
}

function sectionFilterParams(filters: SectionListFilters) {
  return {
    campusId: filters.campusId,
    categoryId: filters.categoryId,
    classTypeId: filters.classTypeId,
    courseCode: filters.courseCode,
    credits: filters.credits,
    departmentId: filters.departmentId,
    educationLevelId: filters.educationLevelId,
    order: filters.sort ? filters.order : null,
    search: filters.search,
    sectionCode: filters.sectionCode,
    semesterId: filters.semesterId,
    sort: filters.sort,
    teacher: filters.teacher,
  };
}

function namedOptions(
  items: SectionListOptionSource[],
  emptyLabel: string,
): SectionListOption[] {
  return [
    { value: "", label: emptyLabel },
    ...items.map((item) => ({
      value: String(item.id),
      label: primaryName(item),
    })),
  ];
}

function optionLabel(options: SectionListOption[], value: string) {
  return options.find((option) => option.value === value)?.label ?? value;
}

function textFilter(
  key: "courseCode" | "credits" | "sectionCode" | "teacher",
  label: string,
) {
  const value = data.filters[key];
  return value
    ? {
        href: sectionFilterHref({ [key]: "" }),
        label: `${label}: ${value}`,
      }
    : null;
}

function optionFilter(
  key:
    | "campusId"
    | "categoryId"
    | "classTypeId"
    | "departmentId"
    | "educationLevelId",
  label: string,
  options: SectionListOption[],
) {
  const value = data.filters[key];
  return value
    ? {
        href: sectionFilterHref({ [key]: "" }),
        label: `${label}: ${optionLabel(options, value)}`,
      }
    : null;
}

function sortLabel(value: string) {
  const labels: Record<string, string> = {
    campus: sectionLabels.filters.sortCampus,
    capacity: sectionLabels.filters.sortCapacity,
    code: sectionLabels.filters.sortCode,
    course: sectionLabels.filters.sortCourse,
    credits: sectionLabels.filters.sortCredits,
    semester: sectionLabels.filters.sortSemester,
    teacher: sectionLabels.filters.sortTeacherCount,
  };
  return labels[value] ?? value;
}

function sectionEmptyDescription() {
  if (data.filters.search) {
    return sectionLabels.searchFor.replace("{query}", data.filters.search);
  }
  if (selectedSemester) {
    return sectionLabels.inSemester.replace(
      "{semester}",
      formatSemesterName(locale, selectedSemester.nameCn),
    );
  }
  return sectionLabels.subtitle;
}
let totalPages = $derived(data.pagination.totalPages);
let locale = $derived(routePage.data.locale ?? "zh-cn");
let commonLabels = $derived(data.labels.common);
let sectionLabels = $derived(data.labels.sections);
let selectedSemester = $derived(
  data.filterOptions.semesters.find(
    (semester) => data.filters.semesterId === String(semester.id),
  ) ?? null,
);
let semesterOptions = $derived([
  { value: "", label: commonLabels.allSemesters },
  ...data.filterOptions.semesters.map((semester) => ({
    value: String(semester.id),
    label: formatSemesterName(locale, semester.nameCn),
  })),
]);
let campusOptions = $derived(
  namedOptions(
    data.filterOptions.campuses,
    `${sectionLabels.filters.any} · ${sectionLabels.campus}`,
  ),
);
let departmentOptions = $derived(
  namedOptions(
    data.filterOptions.departments,
    `${sectionLabels.filters.any} · ${sectionLabels.department}`,
  ),
);
let categoryOptions = $derived(
  namedOptions(
    data.filterOptions.categories,
    `${sectionLabels.filters.any} · ${sectionLabels.category}`,
  ),
);
let educationLevelOptions = $derived(
  namedOptions(
    data.filterOptions.educationLevels,
    `${sectionLabels.filters.any} · ${sectionLabels.educationLevel}`,
  ),
);
let classTypeOptions = $derived(
  namedOptions(
    data.filterOptions.classTypes,
    `${sectionLabels.filters.any} · ${sectionLabels.classType}`,
  ),
);
let sectionResultsData = $derived({
  data: data.data,
  filters: data.filters,
  pagination: { total: data.pagination.total },
});
let sectionActiveFilters = $derived(
  [
    data.filters.search
      ? {
          href: sectionFilterHref({ search: "" }),
          label: `${commonLabels.search}: ${data.filters.search}`,
        }
      : null,
    data.filters.semesterId
      ? {
          href: sectionFilterHref({ semesterId: "" }),
          label: `${sectionLabels.semester}: ${selectedSemester ? formatSemesterName(locale, selectedSemester.nameCn) : data.filters.semesterId}`,
        }
      : null,
    textFilter("teacher", sectionLabels.teachers),
    textFilter("courseCode", sectionLabels.courseCode),
    textFilter("sectionCode", sectionLabels.sectionCode),
    optionFilter("campusId", sectionLabels.campus, campusOptions),
    textFilter("credits", sectionLabels.credits),
    optionFilter("departmentId", sectionLabels.department, departmentOptions),
    optionFilter("categoryId", sectionLabels.category, categoryOptions),
    optionFilter(
      "educationLevelId",
      sectionLabels.educationLevel,
      educationLevelOptions,
    ),
    optionFilter("classTypeId", sectionLabels.classType, classTypeOptions),
    data.filters.sort
      ? {
          href: sectionFilterHref({ order: null, sort: "" }),
          label: `${sectionLabels.filters.sortBy}: ${sortLabel(data.filters.sort)} · ${
            data.filters.order === "desc"
              ? sectionLabels.filters.orderDesc
              : sectionLabels.filters.orderAsc
          }`,
        }
      : null,
  ].filter(
    (filter): filter is { href: string; label: string } => filter !== null,
  ),
);
let sectionHiddenFilters = $derived(
  Object.entries(sectionFilterParams({ ...data.filters, search: null }))
    .filter(
      (entry): entry is [string, string] =>
        entry[0] !== "search" && Boolean(entry[1]),
    )
    .map(([name, value]) => ({ name, value })),
);
function sorting(key: string) {
  return {
    key,
    label: sortLabel(key),
    ascending: sectionLabels.filters.orderAsc,
    descending: sectionLabels.filters.orderDesc,
    default: sectionLabels.filters.defaultSort,
  };
}
const columnDefaults = $derived({
  action: "/catalog/sections",
  filters: sectionFilterParams(data.filters),
  search: sectionSearch,
  applyLabel: sectionLabels.filters.apply,
  clearLabel: commonLabels.clear,
});
const columnFilters = $derived<Record<string, CatalogColumnFilterProps>>({
  semester: {
    ...columnDefaults,
    label: sectionLabels.semester,
    sorting: sorting("semester"),
    fields: [
      {
        name: "semesterId",
        label: sectionLabels.semester,
        options: semesterOptions,
      },
    ],
  },
  course: {
    ...columnDefaults,
    label: sectionLabels.courseName,
    sorting: sorting("course"),
    fields: [
      { name: "courseCode", label: sectionLabels.courseCode },
      {
        name: "categoryId",
        label: sectionLabels.category,
        options: categoryOptions,
      },
      {
        name: "educationLevelId",
        label: sectionLabels.educationLevel,
        options: educationLevelOptions,
      },
      {
        name: "classTypeId",
        label: sectionLabels.classType,
        options: classTypeOptions,
      },
    ],
  },
  code: {
    ...columnDefaults,
    label: sectionLabels.sectionCode,
    sorting: sorting("code"),
    fields: [{ name: "sectionCode", label: sectionLabels.sectionCode }],
  },
  teacher: {
    ...columnDefaults,
    label: sectionLabels.teachers,
    sorting: sorting("teacher"),
    fields: [{ name: "teacher", label: sectionLabels.teachers }],
  },
  credits: {
    ...columnDefaults,
    label: sectionLabels.credits,
    align: "end",
    sorting: sorting("credits"),
    fields: [
      {
        name: "credits",
        label: sectionLabels.credits,
        type: "number",
        min: 0,
        step: 0.5,
        description: sectionLabels.filters.exactCredits,
      },
    ],
  },
  capacity: {
    ...columnDefaults,
    label: sectionLabels.capacity,
    align: "end",
    sorting: sorting("capacity"),
  },
  campus: {
    ...columnDefaults,
    label: sectionLabels.campus,
    sorting: sorting("campus"),
    fields: [
      { name: "campusId", label: sectionLabels.campus, options: campusOptions },
    ],
  },
});
const departmentFilter = $derived<CatalogColumnFilterProps>({
  ...columnDefaults,
  label: sectionLabels.department,
  fields: [
    {
      name: "departmentId",
      label: sectionLabels.department,
      options: departmentOptions,
    },
  ],
});
</script>


{#snippet paginationFooter()}
  <ListPagination
    ariaLabel={commonLabels.pagination}
    class="py-0"
    nextLabel={commonLabels.next}
    nextPageLabel={commonLabels.nextPage}
    page={data.pagination.page}
    pageHref={pageHref}
    previousLabel={commonLabels.previous}
    previousPageLabel={commonLabels.previousPage}
    totalPages={totalPages}
  />
{/snippet}

{#snippet controls(prefix: string)}
  <CatalogFilters
    activeFilters={sectionActiveFilters}
    clearHref="/catalog/sections"
    clearLabel={commonLabels.clear}
    filterTitle={sectionLabels.summary.filters}
    hiddenFilters={sectionHiddenFilters}
    searchId={prefix + "-section-search"}
    searchLabel={commonLabels.search}
    searchPlaceholder={sectionLabels.searchPlaceholder}
    bind:searchValue={sectionSearch}
  >
    <CatalogColumnFilter {...departmentFilter} idPrefix={prefix + "-section-department"} />
    <TableColumnHeader label={sectionLabels.searchHelpTitle}>
      <p class="mb-3 text-sm text-muted-foreground">{sectionLabels.searchHelpDescription}</p>
      <Item.Group>
        {#each sectionLabels.searchHelpExamples as example}
          <Item.Root size="sm">
            <Item.Content>
              <Item.Title class="line-clamp-none break-all"><code>{example.syntax}</code></Item.Title>
              <Item.Description class="line-clamp-none">{example.description}</Item.Description>
              <Item.Description class="line-clamp-none break-all"><code>{example.example}</code></Item.Description>
            </Item.Content>
          </Item.Root>
        {/each}
      </Item.Group>
    </TableColumnHeader>
  </CatalogFilters>
{/snippet}

<CollectionPage description={sectionLabels.subtitle} footer={totalPages > 1 ? paginationFooter : undefined} title={sectionLabels.title}>
  <SectionsResults
    {controls}
    {columnFilters}
    data={sectionResultsData}
    page={data.pagination.page}
    primaryName={primaryName}
    sectionEmptyDescription={sectionEmptyDescription}
    sectionLabels={sectionLabels}
    selectedSemester={selectedSemester}
    totalPages={totalPages}
  />
</CollectionPage>
