<script lang="ts">
import { Button } from "$lib/components/ui/button/index.js";
import * as Card from "$lib/components/ui/card/index.js";
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

<Card.Root class="border-base-300 bg-base-100">
  <Card.Header>
    <Card.Title>{teacherLabels.filterTitle}</Card.Title>
    <Card.Description>{teacherLabels.filterDescription}</Card.Description>
  </Card.Header>
  <Card.Content>
    <form method="GET" class="grid gap-4">
      <Field.Group class="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-end">
        <Field.Field class="min-w-0 lg:flex-[1.6]">
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
        <Field.Field class="min-w-0 lg:flex-1">
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
        <div class="flex shrink-0 flex-wrap gap-2">
          <Button class="min-w-28" size="lg" type="submit">{commonLabels.search}</Button>
          {#if activeFilterCount > 0}
            <Button class="min-w-28" href="/teachers" size="lg" variant="outline">{commonLabels.clear}</Button>
          {/if}
        </div>
      </Field.Group>
    </form>
  </Card.Content>
</Card.Root>
