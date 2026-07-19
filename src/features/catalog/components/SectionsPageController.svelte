<script lang="ts">
import {
  catalogHref,
  catalogPrimaryName as primaryName,
  catalogSecondaryName as secondaryName,
  catalogNames as teacherNames,
} from "@/features/catalog/lib/catalog-list-display";
import CatalogMobileFilters from "./CatalogMobileFilters.svelte";
import CatalogPageHeader from "./CatalogPageHeader.svelte";
import CatalogPagination from "./CatalogPagination.svelte";
import type {
  SectionListCommonLabels,
  SectionListFilters,
  SectionListLabels,
  SectionListOption,
  SectionListOptionSource,
  SectionListRow,
  SectionListSemester,
} from "./catalog-section-list-types";
import SectionsFilters from "./SectionsFilters.svelte";
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
    sections: SectionListLabels & {
      title: string;
    };
  };
  pagination: {
    page: number;
    total: number;
    totalPages: number;
  };
};

export let data: PageData;

let isSectionFilterOpen = false;
let sectionSearch = data.filters.search ?? "";

$: totalPages = data.pagination.totalPages;
$: sectionSearch = data.filters.search ?? "";
$: commonLabels = data.labels.common;
$: sectionLabels = data.labels.sections;
$: selectedSemester =
  data.filterOptions.semesters.find(
    (semester) => data.filters.semesterId === String(semester.id),
  ) ?? null;
$: semesterOptions = namedOptions(
  data.filterOptions.semesters,
  commonLabels.allSemesters,
);
$: campusOptions = namedOptions(
  data.filterOptions.campuses,
  `${sectionLabels.filters.any} · ${sectionLabels.campus}`,
);
$: departmentOptions = namedOptions(
  data.filterOptions.departments,
  `${sectionLabels.filters.any} · ${sectionLabels.department}`,
);
$: categoryOptions = namedOptions(
  data.filterOptions.categories,
  `${sectionLabels.filters.any} · ${sectionLabels.category}`,
);
$: educationLevelOptions = namedOptions(
  data.filterOptions.educationLevels,
  `${sectionLabels.filters.any} · ${sectionLabels.educationLevel}`,
);
$: classTypeOptions = namedOptions(
  data.filterOptions.classTypes,
  `${sectionLabels.filters.any} · ${sectionLabels.classType}`,
);
$: sectionResultsData = {
  data: data.data,
  filters: data.filters,
  pagination: { total: data.pagination.total },
};
$: sectionActiveFilters = [
  data.filters.search
    ? {
        href: sectionFilterHref({ search: "" }),
        label: `${commonLabels.search}: ${data.filters.search}`,
      }
    : null,
  data.filters.semesterId
    ? {
        href: sectionFilterHref({ semesterId: "" }),
        label: `${sectionLabels.semester}: ${selectedSemester?.nameCn ?? data.filters.semesterId}`,
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
);
$: sectionHiddenFilters = Object.entries(
  sectionFilterParams({ ...data.filters, search: null }),
).map(([name, value]) => ({ name, value: value ?? "" }));

function pageHref(targetPage: number) {
  return catalogHref(
    "/sections",
    sectionFilterParams(data.filters),
    targetPage,
  );
}

function sectionFilterHref(overrides: Partial<SectionListFilters>) {
  return catalogHref(
    "/sections",
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
      selectedSemester.nameCn,
    );
  }
  return sectionLabels.subtitle;
}
</script>

<svelte:head><title>{commonLabels.sections} - Life@USTC</title></svelte:head>

<section class="grid gap-5">
  <CatalogPageHeader
    description={sectionLabels.subtitle}
    title={sectionLabels.title}
  />

  <div class="grid min-w-0 gap-4">
    <CatalogMobileFilters
      activeFilters={sectionActiveFilters}
      clearHref="/sections"
      clearLabel={commonLabels.clear}
      filterDescription={sectionLabels.filterDescription}
      filterTitle={sectionLabels.summary.filters}
      hiddenFilters={sectionHiddenFilters}
      bind:open={isSectionFilterOpen}
      searchId="mobile-section-search"
      searchLabel={commonLabels.search}
      searchPlaceholder={sectionLabels.searchPlaceholder}
      bind:searchValue={sectionSearch}
    >
      <SectionsFilters
        {campusOptions}
        {categoryOptions}
        {classTypeOptions}
        clearHref="/sections"
        {commonLabels}
        {departmentOptions}
        {educationLevelOptions}
        filters={data.filters}
        idPrefix="mobile-section"
        onSubmit={() => {
          isSectionFilterOpen = false;
        }}
        {sectionLabels}
        {semesterOptions}
      />
    </CatalogMobileFilters>

    <div class="grid min-w-0 gap-4">
      <SectionsResults
        data={sectionResultsData}
        page={data.pagination.page}
        {primaryName}
        {sectionEmptyDescription}
        {sectionLabels}
        {secondaryName}
        {selectedSemester}
        {teacherNames}
        {totalPages}
      />

      <CatalogPagination
        ariaLabel={commonLabels.pagination}
        nextLabel={commonLabels.next}
        nextPageLabel={commonLabels.nextPage}
        page={data.pagination.page}
        {pageHref}
        previousLabel={commonLabels.previous}
        previousPageLabel={commonLabels.previousPage}
        {totalPages}
      />
    </div>
  </div>
</section>
