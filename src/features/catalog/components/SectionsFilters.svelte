<script lang="ts">
import { Button } from "$lib/components/ui/button/index.js";
import * as Card from "$lib/components/ui/card/index.js";
import { Input } from "$lib/components/ui/input/index.js";
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
      <div class="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-end">
        <label class="grid min-w-0 gap-2 lg:flex-[1.6]">
          <span class="font-medium text-sm">{commonLabels.search}</span>
          <Input
            name="search"
            placeholder={sectionLabels.searchPlaceholder}
            type="search"
            value={sectionSearch}
            oninput={(event: Event) => {
              sectionSearch = (event.currentTarget as HTMLInputElement).value;
            }}
          />
        </label>
        <label class="grid min-w-0 gap-2 lg:flex-1">
          <span class="font-medium text-sm">{sectionLabels.semester}</span>
          <Select
            items={semesterOptions}
            name="semesterId"
            value={filters.semesterId ?? ""}
            onchange={(event) =>
              updateSectionFilter({
                semesterId: event.currentTarget.value,
              })}
          />
        </label>
        <div class="flex shrink-0 flex-wrap gap-2">
          <Button class="min-w-28" size="lg" type="submit">{commonLabels.search}</Button>
          <Button
            aria-label="Help"
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
      </div>
    </form>
  </Card.Content>
</Card.Root>

<SectionSearchHelpDialog bind:isSearchHelpOpen {sectionLabels} />
