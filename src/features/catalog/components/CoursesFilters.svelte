<script lang="ts">
import { Button } from "$lib/components/ui/button/index.js";
import * as Card from "$lib/components/ui/card/index.js";
import { Input } from "$lib/components/ui/input/index.js";
import { Select } from "$lib/components/ui/select/index.js";
import type {
  CourseListCommonLabels,
  CourseListFilters,
  CourseListFilterUpdater,
  CourseListLabels,
  CourseListOption,
} from "./catalog-course-list-types";

export let activeFilterCount: number;
export let categoryOptions: CourseListOption[];
export let classTypeOptions: CourseListOption[];
export let commonLabels: CourseListCommonLabels;
export let courseLabels: CourseListLabels;
export let courseSearch: string;
export let educationLevelOptions: CourseListOption[];
export let filters: CourseListFilters;
export let updateCourseFilter: CourseListFilterUpdater;
</script>

<Card.Root class="border-base-300 bg-base-100">
  <Card.Header>
    <Card.Title>{courseLabels.summary.filters}</Card.Title>
    <Card.Description>{courseLabels.subtitle}</Card.Description>
  </Card.Header>
  <Card.Content>
    <form method="GET" class="grid gap-4">
      <div class="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-end">
        <label class="grid min-w-0 gap-2 lg:flex-[1.4]">
          <span class="font-medium text-sm">{commonLabels.search}</span>
          <Input
            name="search"
            placeholder={courseLabels.searchPlaceholder}
            type="search"
            value={courseSearch}
            oninput={(event: Event) => {
              courseSearch = (event.currentTarget as HTMLInputElement).value;
            }}
          />
        </label>
        <label class="grid min-w-0 gap-2 lg:flex-1">
          <span class="font-medium text-sm">{courseLabels.educationLevel}</span>
          <Select
            items={educationLevelOptions}
            name="educationLevelId"
            value={filters.educationLevelId ?? ""}
            onchange={(event) =>
              updateCourseFilter({
                educationLevelId: event.currentTarget.value,
              })}
          />
        </label>
        <label class="grid min-w-0 gap-2 lg:flex-1">
          <span class="font-medium text-sm">{courseLabels.category}</span>
          <Select
            items={categoryOptions}
            name="categoryId"
            value={filters.categoryId ?? ""}
            onchange={(event) =>
              updateCourseFilter({
                categoryId: event.currentTarget.value,
              })}
          />
        </label>
        <label class="grid min-w-0 gap-2 lg:flex-1">
          <span class="font-medium text-sm">{courseLabels.classType}</span>
          <Select
            items={classTypeOptions}
            name="classTypeId"
            value={filters.classTypeId ?? ""}
            onchange={(event) =>
              updateCourseFilter({
                classTypeId: event.currentTarget.value,
              })}
          />
        </label>
        <div class="flex shrink-0 flex-wrap gap-2">
          <Button class="min-w-28" size="lg" type="submit">
            {commonLabels.search}
          </Button>
          {#if activeFilterCount > 0}
            <Button class="min-w-28" href="/courses" size="lg" variant="outline">{commonLabels.clear}</Button>
          {/if}
        </div>
      </div>
    </form>
  </Card.Content>
</Card.Root>
