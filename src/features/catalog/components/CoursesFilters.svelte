<script lang="ts">
import { Button } from "$lib/components/ui/button/index.js";
import * as Field from "$lib/components/ui/field/index.js";
import * as NativeSelect from "$lib/components/ui/native-select/index.js";
import type {
  CourseListCommonLabels,
  CourseListFilters,
  CourseListLabels,
  CourseListOption,
} from "./catalog-course-list-types";

export let categoryOptions: CourseListOption[];
export let classTypeOptions: CourseListOption[];
export let commonLabels: CourseListCommonLabels;
export let courseLabels: CourseListLabels;
export let courseSearch: string;
export let educationLevelOptions: CourseListOption[];
export let filters: CourseListFilters;
export let idPrefix = "course";

const controlClass = "w-full";
</script>
<form method="GET">
  <input name="search" type="hidden" value={courseSearch} />
  <Field.Group class="gap-3">
    <Field.Field>
      <Field.Label
        for={`${idPrefix}-education-level`}
      >
        {courseLabels.educationLevel}
      </Field.Label>
      <NativeSelect.Root
        class={controlClass}
        id={`${idPrefix}-education-level`}
        name="educationLevelId"
        value={filters.educationLevelId ?? ""}
      >
        {#each educationLevelOptions as option}
          <NativeSelect.Option value={option.value}>
            {option.label}
          </NativeSelect.Option>
        {/each}
      </NativeSelect.Root>
    </Field.Field>
    <Field.Field>
      <Field.Label
        for={`${idPrefix}-category`}
      >
        {courseLabels.category}
      </Field.Label>
      <NativeSelect.Root
        class={controlClass}
        id={`${idPrefix}-category`}
        name="categoryId"
        value={filters.categoryId ?? ""}
      >
        {#each categoryOptions as option}
          <NativeSelect.Option value={option.value}>
            {option.label}
          </NativeSelect.Option>
        {/each}
      </NativeSelect.Root>
    </Field.Field>
    <Field.Field
    >
      <Field.Label
        for={`${idPrefix}-class-type`}
      >
        {courseLabels.classType}
      </Field.Label>
      <NativeSelect.Root
        class={controlClass}
        id={`${idPrefix}-class-type`}
        name="classTypeId"
        value={filters.classTypeId ?? ""}
      >
        {#each classTypeOptions as option}
          <NativeSelect.Option value={option.value}>
            {option.label}
          </NativeSelect.Option>
        {/each}
      </NativeSelect.Root>
    </Field.Field>
    <div class="flex flex-wrap gap-2">
      <Button type="submit">{commonLabels.applyFilters}</Button>
      <Button href="/catalog/courses" variant="outline">{commonLabels.clear}</Button>
    </div>
  </Field.Group>
</form>
