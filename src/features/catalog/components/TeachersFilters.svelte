<script lang="ts">
import { Button } from "$lib/components/ui/button/index.js";
import * as Field from "$lib/components/ui/field/index.js";
import * as InputGroup from "$lib/components/ui/input-group/index.js";
import { Select } from "$lib/components/ui/select/index.js";
import type {
  TeacherListCommonLabels,
  TeacherListFilters,
  TeacherListFilterUpdater,
  TeacherListLabels,
  TeacherListOption,
} from "./catalog-teacher-list-types";

export let activeFilterCount: number;
export let commonLabels: TeacherListCommonLabels;
export let departmentOptions: TeacherListOption[];
export let filters: TeacherListFilters;
export let teacherLabels: TeacherListLabels;
export let teacherSearch: string;
export let updateTeacherFilter: TeacherListFilterUpdater;
</script>

<form method="GET">
  <Field.Group class="gap-3">
    <Field.Field>
      <Field.Label for="teacher-search">{teacherLabels.searchLabel}</Field.Label>
      <InputGroup.Root>
        <InputGroup.Input
          id="teacher-search"
          name="search"
          placeholder={teacherLabels.searchNameOrCode}
          type="search"
          value={teacherSearch}
          oninput={(event: Event) => {
            teacherSearch = (event.currentTarget as HTMLInputElement).value;
          }}
        />
      </InputGroup.Root>
    </Field.Field>
    <Field.Field>
      <Field.Label for="teacher-department">{teacherLabels.department}</Field.Label>
      <Select
        id="teacher-department"
        items={departmentOptions}
        name="departmentId"
        value={filters.departmentId ?? ""}
        onchange={(event) =>
          updateTeacherFilter({
            departmentId: event.currentTarget.value,
          })}
      />
    </Field.Field>
    <div class="grid gap-2 pt-1">
      <Button class="w-full" size="lg" type="submit">{commonLabels.search}</Button>
      {#if activeFilterCount > 0}
        <Button class="w-full" href="/teachers" size="lg" variant="outline">{commonLabels.clear}</Button>
      {/if}
    </div>
  </Field.Group>
</form>
