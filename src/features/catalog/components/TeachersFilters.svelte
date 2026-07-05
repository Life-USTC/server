<script lang="ts">
import { Button } from "$lib/components/ui/button/index.js";
import * as ButtonGroup from "$lib/components/ui/button-group/index.js";
import * as Field from "$lib/components/ui/field/index.js";
import { Input } from "$lib/components/ui/input/index.js";
import * as NativeSelect from "$lib/components/ui/native-select/index.js";
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
      <Input
        id="teacher-search"
        name="search"
        placeholder={teacherLabels.searchNameOrCode}
        type="search"
        value={teacherSearch}
        oninput={(event: Event) => {
          teacherSearch = (event.currentTarget as HTMLInputElement).value;
        }}
      />
    </Field.Field>
    <Field.Field>
      <Field.Label for="teacher-department">{teacherLabels.department}</Field.Label>
      <NativeSelect.Root
        class="w-full"
        id="teacher-department"
        name="departmentId"
        value={filters.departmentId ?? ""}
        onchange={(event) =>
          updateTeacherFilter({
            departmentId: (event.currentTarget as HTMLSelectElement).value,
          })}
      >
        {#each departmentOptions as option}
          <NativeSelect.Option value={option.value}>
            {option.label}
          </NativeSelect.Option>
        {/each}
      </NativeSelect.Root>
    </Field.Field>
    <ButtonGroup.Root class="w-full pt-1" orientation="vertical">
      <Button class="w-full" size="lg" type="submit">{commonLabels.search}</Button>
      {#if activeFilterCount > 0}
        <Button class="w-full" href="/teachers" size="lg" variant="outline">{commonLabels.clear}</Button>
      {/if}
    </ButtonGroup.Root>
  </Field.Group>
</form>
