<script lang="ts">
import { Button } from "$lib/components/ui/button/index.js";
import * as ButtonGroup from "$lib/components/ui/button-group/index.js";
import * as Field from "$lib/components/ui/field/index.js";
import { Input } from "$lib/components/ui/input/index.js";
import * as Select from "$lib/components/ui/select/index.js";
import type {
  SectionListCommonLabels,
  SectionListFilters,
  SectionListFilterUpdater,
  SectionListLabels,
  SectionListOption,
} from "./catalog-section-list-types";
import SectionSearchHelpDialog from "./SectionSearchHelpDialog.svelte";

export let activeFilterCount: number;
export let commonLabels: SectionListCommonLabels;
export let filters: SectionListFilters;
export let isSearchHelpOpen: boolean;
export let sectionLabels: SectionListLabels;
export let sectionSearch: string;
export let semesterOptions: SectionListOption[];
export let updateSectionFilter: SectionListFilterUpdater;
</script>

<form method="GET">
  <Field.Group class="gap-3">
    <Field.Field>
      <Field.Label for="section-search">{commonLabels.search}</Field.Label>
      <Input
        id="section-search"
        name="search"
        placeholder={sectionLabels.searchPlaceholder}
        type="search"
        value={sectionSearch}
        oninput={(event: Event) => {
          sectionSearch = (event.currentTarget as HTMLInputElement).value;
        }}
      />
    </Field.Field>
    <Field.Field>
      <Field.Label for="section-semester">{sectionLabels.semester}</Field.Label>
      <Select.Root
        name="semesterId"
        value={filters.semesterId ?? ""}
        type="single"
        onValueChange={(value) =>
          updateSectionFilter({
            semesterId: value,
          })}
      >
        <Select.Trigger id="section-semester" class="w-full">
          {semesterOptions.find(
            (option) => option.value === (filters.semesterId ?? ""),
          )?.label ?? semesterOptions[0]?.label ?? ""}
        </Select.Trigger>
        <Select.Content>
          <Select.Group>
            {#each semesterOptions as option}
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
      <Button
        class="w-full"
        onclick={() => {
          isSearchHelpOpen = true;
        }}
        size="lg"
        type="button"
        variant="outline"
      >
        {sectionLabels.searchHelpTitle}
      </Button>
      {#if activeFilterCount > 0}
        <Button class="w-full" href="/sections" size="lg" variant="outline">{commonLabels.clear}</Button>
      {/if}
    </ButtonGroup.Root>
  </Field.Group>
</form>

<SectionSearchHelpDialog bind:isSearchHelpOpen {sectionLabels} />
