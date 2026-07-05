<script lang="ts">
import { Button } from "$lib/components/ui/button/index.js";
import * as ButtonGroup from "$lib/components/ui/button-group/index.js";
import * as Field from "$lib/components/ui/field/index.js";
import * as InputGroup from "$lib/components/ui/input-group/index.js";
import * as Select from "$lib/components/ui/select/index.js";
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
      <Select.Root
        name="departmentId"
        value={filters.departmentId ?? ""}
        type="single"
        onValueChange={(value) =>
          updateTeacherFilter({
            departmentId: value,
          })}
      >
        <Select.Trigger id="teacher-department" class="w-full">
          {departmentOptions.find(
            (option) => option.value === (filters.departmentId ?? ""),
          )?.label ?? departmentOptions[0]?.label ?? ""}
        </Select.Trigger>
        <Select.Content>
          <Select.Group>
            {#each departmentOptions as option}
              <Select.Item label={option.label} value={option.value}>
                {option.label}
              </Select.Item>
            {/each}
          </Select.Group>
        </Select.Content>
      </Select.Root>
    </Field.Field>
    <ButtonGroup.Root class="w-full pt-1" orientation="vertical">
      <Button class="w-full" size="lg" type="submit">{commonLabels.search}</Button>
      {#if activeFilterCount > 0}
        <Button class="w-full" href="/teachers" size="lg" variant="outline">{commonLabels.clear}</Button>
      {/if}
    </ButtonGroup.Root>
  </Field.Group>
</form>
