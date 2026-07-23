<script lang="ts">
import { Button } from "$lib/components/ui/button/index.js";
import * as ButtonGroup from "$lib/components/ui/button-group/index.js";
import * as Field from "$lib/components/ui/field/index.js";
import { Input } from "$lib/components/ui/input/index.js";
import * as NativeSelect from "$lib/components/ui/native-select/index.js";
import { cn } from "$lib/utils.js";
import type {
  CourseListCommonLabels,
  CourseListFilters,
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
export let idPrefix = "course";
export let inline = false;
export let showClear = true;
export let showSearch = true;

const controlClass = "w-full [&>select]:h-11";
</script>

<form method="GET">
  {#if !showSearch && filters.search}
    <input name="search" type="hidden" value={filters.search} />
  {/if}
  <Field.Group
    class={cn(
      "gap-3",
      inline &&
        "grid min-[320px]:grid-cols-2 lg:grid-cols-3 xl:flex xl:w-[34rem] xl:flex-row xl:gap-2",
    )}
  >
    {#if showSearch}
      <Field.Field>
        <Field.Label for={`${idPrefix}-search`}>{commonLabels.search}</Field.Label>
        <Input
          id={`${idPrefix}-search`}
          name="search"
          placeholder={courseLabels.searchPlaceholder}
          type="search"
          value={courseSearch}
          oninput={(event: Event) => {
            courseSearch = (event.currentTarget as HTMLInputElement).value;
          }}
        />
      </Field.Field>
    {/if}
    <Field.Field class={cn(inline && "xl:w-44 xl:shrink-0")}>
      <Field.Label
        class={cn(inline && "sr-only")}
        for={`${idPrefix}-education-level`}
      >
        {courseLabels.educationLevel}
      </Field.Label>
      <NativeSelect.Root
        class={controlClass}
        id={`${idPrefix}-education-level`}
        name="educationLevelId"
        value={filters.educationLevelId ?? ""}
        onchange={(event) => event.currentTarget.form?.requestSubmit()}
      >
        {#each educationLevelOptions as option}
          <NativeSelect.Option value={option.value}>
            {option.label}
          </NativeSelect.Option>
        {/each}
      </NativeSelect.Root>
    </Field.Field>
    <Field.Field class={cn(inline && "xl:w-44 xl:shrink-0")}>
      <Field.Label
        class={cn(inline && "sr-only")}
        for={`${idPrefix}-category`}
      >
        {courseLabels.category}
      </Field.Label>
      <NativeSelect.Root
        class={controlClass}
        id={`${idPrefix}-category`}
        name="categoryId"
        value={filters.categoryId ?? ""}
        onchange={(event) => event.currentTarget.form?.requestSubmit()}
      >
        {#each categoryOptions as option}
          <NativeSelect.Option value={option.value}>
            {option.label}
          </NativeSelect.Option>
        {/each}
      </NativeSelect.Root>
    </Field.Field>
    <Field.Field
      class={cn(
        inline &&
          "min-[320px]:col-span-2 lg:col-span-1 xl:w-44 xl:shrink-0",
      )}
    >
      <Field.Label
        class={cn(inline && "sr-only")}
        for={`${idPrefix}-class-type`}
      >
        {courseLabels.classType}
      </Field.Label>
      <NativeSelect.Root
        class={controlClass}
        id={`${idPrefix}-class-type`}
        name="classTypeId"
        value={filters.classTypeId ?? ""}
        onchange={(event) => event.currentTarget.form?.requestSubmit()}
      >
        {#each classTypeOptions as option}
          <NativeSelect.Option value={option.value}>
            {option.label}
          </NativeSelect.Option>
        {/each}
      </NativeSelect.Root>
    </Field.Field>
    {#if showSearch || (showClear && activeFilterCount > 0)}
      <ButtonGroup.Root class="w-full pt-1" orientation="vertical">
        {#if showSearch}
          <Button class="w-full" size="lg" type="submit">
            {commonLabels.search}
          </Button>
        {/if}
        {#if showClear && activeFilterCount > 0}
          <Button class="w-full" href="/catalog/courses" size="lg" variant="outline">{commonLabels.clear}</Button>
        {/if}
      </ButtonGroup.Root>
    {/if}
  </Field.Group>
</form>
