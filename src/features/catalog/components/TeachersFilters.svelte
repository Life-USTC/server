<script lang="ts">
import { Button } from "$lib/components/ui/button/index.js";
import * as Field from "$lib/components/ui/field/index.js";
import * as NativeSelect from "$lib/components/ui/native-select/index.js";
import type {
  TeacherListCommonLabels,
  TeacherListFilters,
  TeacherListLabels,
  TeacherListOption,
} from "./catalog-teacher-list-types";

export let commonLabels: TeacherListCommonLabels;
export let departmentOptions: TeacherListOption[];
export let filters: TeacherListFilters;
export let idPrefix = "teacher";
export let teacherLabels: TeacherListLabels;
export let teacherSearch: string;

const controlClass = "w-full";
</script>
<form method="GET">
  <input name="search" type="hidden" value={teacherSearch} />
  <Field.Group class="gap-3">
    <Field.Field>
      <Field.Label
        for={`${idPrefix}-department`}
      >
        {teacherLabels.department}
      </Field.Label>
      <NativeSelect.Root
        class={controlClass}
        id={`${idPrefix}-department`}
        name="departmentId"
        value={filters.departmentId ?? ""}
      >
        {#each departmentOptions as option}
          <NativeSelect.Option value={option.value}>
            {option.label}
          </NativeSelect.Option>
        {/each}
      </NativeSelect.Root>
    </Field.Field>
    <div class="flex flex-wrap gap-2">
      <Button type="submit">{commonLabels.applyFilters}</Button>
      <Button href="/catalog/teachers" variant="outline">{commonLabels.clear}</Button>
    </div>
  </Field.Group>
</form>
