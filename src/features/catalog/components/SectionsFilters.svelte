<script lang="ts">
import { Button } from "$lib/components/ui/button/index.js";
import * as ButtonGroup from "$lib/components/ui/button-group/index.js";
import * as Field from "$lib/components/ui/field/index.js";
import { Input } from "$lib/components/ui/input/index.js";
import * as NativeSelect from "$lib/components/ui/native-select/index.js";
import type {
  SectionListCommonLabels,
  SectionListFilters,
  SectionListFilterUpdater,
  SectionListLabels,
  SectionListOption,
} from "./catalog-section-list-types";

export let activeFilterCount: number;
export let commonLabels: SectionListCommonLabels;
export let filters: SectionListFilters;
export let idPrefix = "section";
export let isSearchHelpOpen: boolean;
export let sectionLabels: SectionListLabels;
export let sectionSearch: string;
export let semesterOptions: SectionListOption[];
export let showSearch = true;
export let updateSectionFilter: SectionListFilterUpdater;
</script>

<form method="GET">
  <Field.Group class="gap-3">
    {#if showSearch}
      <Field.Field>
        <Field.Label for={`${idPrefix}-search`}>{commonLabels.search}</Field.Label>
        <Input
          id={`${idPrefix}-search`}
          name="search"
          placeholder={sectionLabels.searchPlaceholder}
          type="search"
          value={sectionSearch}
          oninput={(event: Event) => {
            sectionSearch = (event.currentTarget as HTMLInputElement).value;
          }}
        />
      </Field.Field>
    {/if}
    <Field.Field>
      <Field.Label for={`${idPrefix}-semester`}>{sectionLabels.semester}</Field.Label>
      <NativeSelect.Root
        class="w-full"
        id={`${idPrefix}-semester`}
        name="semesterId"
        value={filters.semesterId ?? ""}
        onchange={(event) =>
          updateSectionFilter({
            semesterId: (event.currentTarget as HTMLSelectElement).value,
          })}
      >
        {#each semesterOptions as option}
          <NativeSelect.Option value={option.value}>
            {option.label}
          </NativeSelect.Option>
        {/each}
      </NativeSelect.Root>
    </Field.Field>
    <ButtonGroup.Root class="w-full pt-1" orientation="vertical">
      {#if showSearch}
        <Button class="w-full" size="lg" type="submit">{commonLabels.search}</Button>
      {/if}
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
