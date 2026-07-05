<script lang="ts">
import { Button } from "$lib/components/ui/button/index.js";
import * as ButtonGroup from "$lib/components/ui/button-group/index.js";
import * as Field from "$lib/components/ui/field/index.js";
import { Input } from "$lib/components/ui/input/index.js";
import * as NativeSelect from "$lib/components/ui/native-select/index.js";
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
      <Input
        id="course-search"
        name="search"
        placeholder={courseLabels.searchPlaceholder}
        type="search"
        value={courseSearch}
        oninput={(event: Event) => {
          courseSearch = (event.currentTarget as HTMLInputElement).value;
        }}
      />
    </Field.Field>
    <Field.Field>
      <Field.Label for="course-education-level">{courseLabels.educationLevel}</Field.Label>
      <NativeSelect.Root
        class="w-full"
        id="course-education-level"
        name="educationLevelId"
        value={filters.educationLevelId ?? ""}
        onchange={(event) =>
          updateCourseFilter({
            educationLevelId: (event.currentTarget as HTMLSelectElement).value,
          })}
      >
        {#each educationLevelOptions as option}
          <NativeSelect.Option value={option.value}>
            {option.label}
          </NativeSelect.Option>
        {/each}
      </NativeSelect.Root>
    </Field.Field>
    <Field.Field>
      <Field.Label for="course-category">{courseLabels.category}</Field.Label>
      <NativeSelect.Root
        class="w-full"
        id="course-category"
        name="categoryId"
        value={filters.categoryId ?? ""}
        onchange={(event) =>
          updateCourseFilter({
            categoryId: (event.currentTarget as HTMLSelectElement).value,
          })}
      >
        {#each categoryOptions as option}
          <NativeSelect.Option value={option.value}>
            {option.label}
          </NativeSelect.Option>
        {/each}
      </NativeSelect.Root>
    </Field.Field>
    <Field.Field>
      <Field.Label for="course-class-type">{courseLabels.classType}</Field.Label>
      <NativeSelect.Root
        class="w-full"
        id="course-class-type"
        name="classTypeId"
        value={filters.classTypeId ?? ""}
        onchange={(event) =>
          updateCourseFilter({
            classTypeId: (event.currentTarget as HTMLSelectElement).value,
          })}
      >
        {#each classTypeOptions as option}
          <NativeSelect.Option value={option.value}>
            {option.label}
          </NativeSelect.Option>
        {/each}
      </NativeSelect.Root>
    </Field.Field>
    <ButtonGroup.Root class="w-full pt-1" orientation="vertical">
      <Button class="w-full" size="lg" type="submit">
        {commonLabels.search}
      </Button>
      {#if activeFilterCount > 0}
        <Button class="w-full" href="/courses" size="lg" variant="outline">{commonLabels.clear}</Button>
      {/if}
    </ButtonGroup.Root>
  </Field.Group>
</form>
