<script lang="ts">
import { Button } from "$lib/components/ui/button/index.js";
import * as Field from "$lib/components/ui/field/index.js";
import * as InputGroup from "$lib/components/ui/input-group/index.js";
import * as Select from "$lib/components/ui/select/index.js";
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

<form method="GET">
  <Field.Group class="gap-3">
    <Field.Field>
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
    <Field.Field>
      <Field.Label for="course-education-level">{courseLabels.educationLevel}</Field.Label>
      <Select.Root
        name="educationLevelId"
        value={filters.educationLevelId ?? ""}
        type="single"
        onValueChange={(value) =>
          updateCourseFilter({
            educationLevelId: value,
          })}
      >
        <Select.Trigger id="course-education-level" class="w-full">
          {educationLevelOptions.find(
            (option) => option.value === (filters.educationLevelId ?? ""),
          )?.label ?? educationLevelOptions[0]?.label ?? ""}
        </Select.Trigger>
        <Select.Content>
          <Select.Group>
            {#each educationLevelOptions as option}
              <Select.Item
                label={option.label}
                value={option.value}
              >
                {option.label}
              </Select.Item>
            {/each}
          </Select.Group>
        </Select.Content>
      </Select.Root>
    </Field.Field>
    <Field.Field>
      <Field.Label for="course-category">{courseLabels.category}</Field.Label>
      <Select.Root
        name="categoryId"
        value={filters.categoryId ?? ""}
        type="single"
        onValueChange={(value) =>
          updateCourseFilter({
            categoryId: value,
          })}
      >
        <Select.Trigger id="course-category" class="w-full">
          {categoryOptions.find(
            (option) => option.value === (filters.categoryId ?? ""),
          )?.label ?? categoryOptions[0]?.label ?? ""}
        </Select.Trigger>
        <Select.Content>
          <Select.Group>
            {#each categoryOptions as option}
              <Select.Item
                label={option.label}
                value={option.value}
              >
                {option.label}
              </Select.Item>
            {/each}
          </Select.Group>
        </Select.Content>
      </Select.Root>
    </Field.Field>
    <Field.Field>
      <Field.Label for="course-class-type">{courseLabels.classType}</Field.Label>
      <Select.Root
        name="classTypeId"
        value={filters.classTypeId ?? ""}
        type="single"
        onValueChange={(value) =>
          updateCourseFilter({
            classTypeId: value,
          })}
      >
        <Select.Trigger id="course-class-type" class="w-full">
          {classTypeOptions.find(
            (option) => option.value === (filters.classTypeId ?? ""),
          )?.label ?? classTypeOptions[0]?.label ?? ""}
        </Select.Trigger>
        <Select.Content>
          <Select.Group>
            {#each classTypeOptions as option}
              <Select.Item
                label={option.label}
                value={option.value}
              >
                {option.label}
              </Select.Item>
            {/each}
          </Select.Group>
        </Select.Content>
      </Select.Root>
    </Field.Field>
    <div class="grid gap-2 pt-1">
      <Button class="w-full" size="lg" type="submit">
        {commonLabels.search}
      </Button>
      {#if activeFilterCount > 0}
        <Button class="w-full" href="/courses" size="lg" variant="outline">{commonLabels.clear}</Button>
      {/if}
    </div>
  </Field.Group>
</form>
