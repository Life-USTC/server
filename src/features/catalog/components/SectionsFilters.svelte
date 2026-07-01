<script lang="ts">
import { Button } from "$lib/components/ui/button/index.js";
import * as Card from "$lib/components/ui/card/index.js";
import * as Field from "$lib/components/ui/field/index.js";
import * as InputGroup from "$lib/components/ui/input-group/index.js";
import { Select } from "$lib/components/ui/select/index.js";
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

<Card.Root class="border-base-300 bg-base-100">
  <Card.Header>
    <Card.Title>{sectionLabels.summary.filters}</Card.Title>
    <Card.Description>{sectionLabels.subtitle}</Card.Description>
  </Card.Header>
  <Card.Content>
    <form method="GET" class="grid gap-4">
      <Field.Group class="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-end">
        <Field.Field class="min-w-0 lg:flex-[1.6]">
          <Field.Label for="section-search">{commonLabels.search}</Field.Label>
          <InputGroup.Root>
            <InputGroup.Input
              id="section-search"
              name="search"
              placeholder={sectionLabels.searchPlaceholder}
              type="search"
              value={sectionSearch}
              oninput={(event: Event) => {
                sectionSearch = (event.currentTarget as HTMLInputElement).value;
              }}
            />
          </InputGroup.Root>
        </Field.Field>
        <Field.Field class="min-w-0 lg:flex-1">
          <Field.Label for="section-semester">{sectionLabels.semester}</Field.Label>
          <Select
            id="section-semester"
            items={semesterOptions}
            name="semesterId"
            value={filters.semesterId ?? ""}
            onchange={(event) =>
              updateSectionFilter({
                semesterId: event.currentTarget.value,
              })}
          />
        </Field.Field>
        <div class="flex shrink-0 flex-wrap gap-2">
          <Button class="min-w-28" size="lg" type="submit">{commonLabels.search}</Button>
          <Button
            aria-label={sectionLabels.searchHelpTitle}
            class="mt-auto"
            onclick={() => {
              isSearchHelpOpen = true;
            }}
            size="icon-lg"
            type="button"
            variant="outline"
          >
            {sectionLabels.searchHelp}
          </Button>
          {#if activeFilterCount > 0}
            <Button class="min-w-28" href="/sections" size="lg" variant="outline">{commonLabels.clear}</Button>
          {/if}
        </div>
      </Field.Group>
    </form>
  </Card.Content>
</Card.Root>

<SectionSearchHelpDialog bind:isSearchHelpOpen {sectionLabels} />
