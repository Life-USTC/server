<script lang="ts">
import { Button } from "$lib/components/ui/button/index.js";
import { Input } from "$lib/components/ui/input/index.js";
import { Select } from "$lib/components/ui/select/index.js";

type FilterOption = {
  label: string;
  value: string;
};

type ModerationFilters = {
  descriptionContent?: string | null;
  descriptionTarget?: string | null;
  search: string;
  status?: string | null;
};

type ModerationFilterCopy = {
  filterAction: string;
  filterQueue: string;
  filterQueueDescription: string;
  searchAllPlaceholder: string;
  searchPlaceholder: string;
};

export let copy: ModerationFilterCopy;
export let descriptionContentOptions: FilterOption[];
export let descriptionTargetOptions: FilterOption[];
export let filters: ModerationFilters;
export let searchQuery: string;
export let statusFilterOptions: FilterOption[];
export let tab: string;
</script>

<form method="GET" class="rounded-md border border-base-300 bg-base-100 p-5 shadow-sm">
  <div class="grid gap-3">
    <div>
      <h2 class="font-semibold">{copy.filterQueue}</h2>
      <p class="text-base-content/60 text-sm">
        {copy.filterQueueDescription}
      </p>
    </div>
    <div class={`grid gap-3 ${tab === "descriptions" ? "md:grid-cols-[180px_180px_minmax(0,1fr)_auto]" : "md:grid-cols-[180px_minmax(0,1fr)_auto]"}`}>
      <input type="hidden" name="tab" value={tab} />
      {#if tab === "descriptions"}
        <Select
          items={descriptionTargetOptions}
          name="descriptionTarget"
          value={filters.descriptionTarget ?? "all"}
        />
        <Select
          items={descriptionContentOptions}
          name="descriptionContent"
          value={filters.descriptionContent ?? "all"}
        />
        <input type="hidden" name="status" value={filters.status ?? "all"} />
      {:else}
        <Select
          items={statusFilterOptions}
          name="status"
          value={filters.status ?? "all"}
        />
        <input
          type="hidden"
          name="descriptionTarget"
          value={filters.descriptionTarget ?? "all"}
        />
        <input
          type="hidden"
          name="descriptionContent"
          value={filters.descriptionContent ?? "all"}
        />
      {/if}
      <Input
        name="search"
        placeholder={tab === "comments" ? copy.searchPlaceholder : copy.searchAllPlaceholder}
        type="search"
        value={searchQuery}
        oninput={(event: Event) => {
          searchQuery = (event.currentTarget as HTMLInputElement).value;
        }}
      />
      <Button type="submit">{copy.filterAction}</Button>
    </div>
  </div>
</form>
