<script lang="ts">
import { Button } from "$lib/components/ui/button/index.js";
import * as Card from "$lib/components/ui/card/index.js";
import * as Field from "$lib/components/ui/field/index.js";
import * as InputGroup from "$lib/components/ui/input-group/index.js";
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
      <Field.Group class="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-end">
        <Field.Field class="min-w-0 lg:flex-[1.4]">
          <Field.Label for="course-search">{commonLabels.search}</Field.Label>
          <InputGroup.Root>
            <InputGroup.Input
              id="course-search"
              name="search"
              placeholder={courseLabels.searchPlaceholder}
              type="search"
              value={courseSearch}
              oninput={(event: Event) => {
                courseSearch = (event.currentTarget as HTMLInputElement).value;
              }}
            />
          </InputGroup.Root>
        </Field.Field>
        <Field.Field class="min-w-0 lg:flex-1">
          <Field.Label for="course-education-level">{courseLabels.educationLevel}</Field.Label>
          <Select
            id="course-education-level"
            items={educationLevelOptions}
            name="educationLevelId"
            value={filters.educationLevelId ?? ""}
            onchange={(event) =>
              updateCourseFilter({
                educationLevelId: event.currentTarget.value,
              })}
          />
        </Field.Field>
        <Field.Field class="min-w-0 lg:flex-1">
          <Field.Label for="course-category">{courseLabels.category}</Field.Label>
          <Select
            id="course-category"
            items={categoryOptions}
            name="categoryId"
            value={filters.categoryId ?? ""}
            onchange={(event) =>
              updateCourseFilter({
                categoryId: event.currentTarget.value,
              })}
          />
        </Field.Field>
        <Field.Field class="min-w-0 lg:flex-1">
          <Field.Label for="course-class-type">{courseLabels.classType}</Field.Label>
          <Select
            id="course-class-type"
            items={classTypeOptions}
            name="classTypeId"
            value={filters.classTypeId ?? ""}
            onchange={(event) =>
              updateCourseFilter({
                classTypeId: event.currentTarget.value,
              })}
          />
        </Field.Field>
        <div class="flex shrink-0 flex-wrap gap-2">
          <Button class="min-w-28" size="lg" type="submit">
            {commonLabels.search}
          </Button>
          {#if activeFilterCount > 0}
            <Button class="min-w-28" href="/courses" size="lg" variant="outline">{commonLabels.clear}</Button>
          {/if}
        </div>
      </Field.Group>
    </form>
  </Card.Content>
</Card.Root>
