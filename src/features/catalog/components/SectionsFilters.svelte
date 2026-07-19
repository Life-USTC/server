<script lang="ts">
import * as Accordion from "$lib/components/ui/accordion/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import * as ButtonGroup from "$lib/components/ui/button-group/index.js";
import * as Field from "$lib/components/ui/field/index.js";
import { Input } from "$lib/components/ui/input/index.js";
import * as Item from "$lib/components/ui/item/index.js";
import * as NativeSelect from "$lib/components/ui/native-select/index.js";
import type {
  SectionListCommonLabels,
  SectionListFilters,
  SectionListLabels,
  SectionListOption,
} from "./catalog-section-list-types";

export let campusOptions: SectionListOption[];
export let categoryOptions: SectionListOption[];
export let classTypeOptions: SectionListOption[];
export let clearHref: string;
export let commonLabels: SectionListCommonLabels;
export let departmentOptions: SectionListOption[];
export let educationLevelOptions: SectionListOption[];
export let filters: SectionListFilters;
export let idPrefix = "section";
export let onSubmit: () => void;
export let sectionLabels: SectionListLabels;
export let semesterOptions: SectionListOption[];

const controlClass = "w-full [&>select]:h-11";
let selectedSort = filters.sort ?? "";

$: selectedSort = filters.sort ?? "";
</script>

<form method="GET" onsubmit={onSubmit}>
  {#if filters.search}
    <input name="search" type="hidden" value={filters.search} />
  {/if}

  <Field.Group class="gap-5">
    <Field.Set>
      <Field.Legend>{sectionLabels.filters.sectionTitle}</Field.Legend>
      <Field.Description>{sectionLabels.filters.sectionDescription}</Field.Description>
      <Field.Group class="gap-3">
        <Field.Field>
          <Field.Label for={`${idPrefix}-semester`}>{sectionLabels.semester}</Field.Label>
          <NativeSelect.Root
            class={controlClass}
            id={`${idPrefix}-semester`}
            name="semesterId"
            value={filters.semesterId ?? ""}
          >
            {#each semesterOptions as option}
              <NativeSelect.Option value={option.value}>
                {option.label}
              </NativeSelect.Option>
            {/each}
          </NativeSelect.Root>
        </Field.Field>

        <Field.Field>
          <Field.Label for={`${idPrefix}-teacher`}>{sectionLabels.teachers}</Field.Label>
          <Input
            class="h-11"
            id={`${idPrefix}-teacher`}
            name="teacher"
            value={filters.teacher ?? ""}
          />
        </Field.Field>

        <div class="grid gap-3 sm:grid-cols-2">
          <Field.Field>
            <Field.Label for={`${idPrefix}-course-code`}>{sectionLabels.courseCode}</Field.Label>
            <Input
              class="h-11"
              id={`${idPrefix}-course-code`}
              name="courseCode"
              value={filters.courseCode ?? ""}
            />
          </Field.Field>
          <Field.Field>
            <Field.Label for={`${idPrefix}-section-code`}>{sectionLabels.sectionCode}</Field.Label>
            <Input
              class="h-11"
              id={`${idPrefix}-section-code`}
              name="sectionCode"
              value={filters.sectionCode ?? ""}
            />
          </Field.Field>
        </div>

        <div class="grid gap-3 sm:grid-cols-2">
          <Field.Field>
            <Field.Label for={`${idPrefix}-campus`}>{sectionLabels.campus}</Field.Label>
            <NativeSelect.Root
              class={controlClass}
              id={`${idPrefix}-campus`}
              name="campusId"
              value={filters.campusId ?? ""}
            >
              {#each campusOptions as option}
                <NativeSelect.Option value={option.value}>
                  {option.label}
                </NativeSelect.Option>
              {/each}
            </NativeSelect.Root>
          </Field.Field>
          <Field.Field>
            <Field.Label for={`${idPrefix}-department`}>{sectionLabels.department}</Field.Label>
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
        </div>

        <Field.Field>
          <Field.Label for={`${idPrefix}-credits`}>{sectionLabels.credits}</Field.Label>
          <Input
            class="h-11"
            id={`${idPrefix}-credits`}
            min="0"
            name="credits"
            step="0.5"
            type="number"
            value={filters.credits ?? ""}
          />
          <Field.Description>{sectionLabels.filters.exactCredits}</Field.Description>
        </Field.Field>
      </Field.Group>
    </Field.Set>

    <Field.Separator />

    <Field.Set>
      <Field.Legend>{sectionLabels.filters.courseTitle}</Field.Legend>
      <Field.Description>{sectionLabels.filters.courseDescription}</Field.Description>
      <Field.Group class="gap-3">
        <Field.Field>
          <Field.Label for={`${idPrefix}-category`}>{sectionLabels.category}</Field.Label>
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
        <Field.Field>
          <Field.Label for={`${idPrefix}-education-level`}>{sectionLabels.educationLevel}</Field.Label>
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
          <Field.Label for={`${idPrefix}-class-type`}>{sectionLabels.classType}</Field.Label>
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
      </Field.Group>
    </Field.Set>

    <Field.Separator />

    <Field.Set>
      <Field.Legend>{sectionLabels.filters.sortingTitle}</Field.Legend>
      <Field.Description>{sectionLabels.filters.sortingDescription}</Field.Description>
      <Field.Group class="gap-3">
        <Field.Field>
          <Field.Label for={`${idPrefix}-sort`}>{sectionLabels.filters.sortBy}</Field.Label>
          <NativeSelect.Root
            bind:value={selectedSort}
            class={controlClass}
            id={`${idPrefix}-sort`}
            name="sort"
          >
            <NativeSelect.Option value="">{sectionLabels.filters.defaultSort}</NativeSelect.Option>
            <NativeSelect.Option value="credits">{sectionLabels.filters.sortCredits}</NativeSelect.Option>
            <NativeSelect.Option value="capacity">{sectionLabels.filters.sortCapacity}</NativeSelect.Option>
            <NativeSelect.Option value="semester">{sectionLabels.filters.sortSemester}</NativeSelect.Option>
            <NativeSelect.Option value="course">{sectionLabels.filters.sortCourse}</NativeSelect.Option>
            <NativeSelect.Option value="code">{sectionLabels.filters.sortCode}</NativeSelect.Option>
            <NativeSelect.Option value="teacher">{sectionLabels.filters.sortTeacherCount}</NativeSelect.Option>
            <NativeSelect.Option value="campus">{sectionLabels.filters.sortCampus}</NativeSelect.Option>
          </NativeSelect.Root>
        </Field.Field>
        <Field.Field>
          <Field.Label for={`${idPrefix}-order`}>{sectionLabels.filters.order}</Field.Label>
          <NativeSelect.Root
            class={controlClass}
            disabled={!selectedSort}
            id={`${idPrefix}-order`}
            name="order"
            value={filters.order ?? "asc"}
          >
            <NativeSelect.Option value="asc">{sectionLabels.filters.orderAsc}</NativeSelect.Option>
            <NativeSelect.Option value="desc">{sectionLabels.filters.orderDesc}</NativeSelect.Option>
          </NativeSelect.Root>
        </Field.Field>
      </Field.Group>
    </Field.Set>

    <Field.Separator />

    <Accordion.Root type="single">
      <Accordion.Item value="syntax">
        <Accordion.Trigger class="text-left">{sectionLabels.searchHelpTitle}</Accordion.Trigger>
        <Accordion.Content>
          <p class="mb-3 text-muted-foreground text-sm">
            {sectionLabels.searchHelpDescription}
          </p>
          <Item.Group>
            {#each sectionLabels.searchHelpExamples as example}
              <Item.Root class="items-start" variant="muted">
                <Item.Content class="min-w-0">
                  <Item.Title class="line-clamp-none break-all">
                    <code>{example.syntax}</code>
                  </Item.Title>
                  <Item.Description class="line-clamp-none break-words">
                    {example.description}
                  </Item.Description>
                  <Item.Description class="line-clamp-none break-all">
                    <code>{example.example}</code>
                  </Item.Description>
                </Item.Content>
              </Item.Root>
            {/each}
          </Item.Group>
        </Accordion.Content>
      </Accordion.Item>
    </Accordion.Root>

    <ButtonGroup.Root class="w-full" orientation="vertical">
      <Button class="w-full" size="lg" type="submit">
        {sectionLabels.filters.apply}
      </Button>
      <Button
        class="w-full"
        href={clearHref}
        onclick={onSubmit}
        size="lg"
        variant="outline"
      >
        {commonLabels.clear}
      </Button>
    </ButtonGroup.Root>
  </Field.Group>
</form>
