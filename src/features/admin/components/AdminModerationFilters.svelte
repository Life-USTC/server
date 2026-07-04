<script lang="ts">
import { Button } from "$lib/components/ui/button/index.js";
import { Input } from "$lib/components/ui/input/index.js";
import * as Select from "$lib/components/ui/select/index.js";

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
  descriptionContent: string;
  descriptionTarget: string;
  filterAction: string;
  filterQueue: string;
  filterQueueDescription: string;
  searchAllPlaceholder: string;
  searchPlaceholder: string;
  status: string;
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
        <Select.Root
          name="descriptionTarget"
          type="single"
          value={filters.descriptionTarget ?? "all"}
        >
          <Select.Trigger
            aria-label={copy.descriptionTarget}
            class="w-full"
          >
            {descriptionTargetOptions.find(
              (option) =>
                option.value === (filters.descriptionTarget ?? "all"),
            )?.label ?? descriptionTargetOptions[0]?.label ?? ""}
          </Select.Trigger>
          <Select.Content>
            <Select.Group>
              {#each descriptionTargetOptions as option}
                <Select.Item label={option.label} value={option.value}>
                  {option.label}
                </Select.Item>
              {/each}
            </Select.Group>
          </Select.Content>
        </Select.Root>
        <Select.Root
          name="descriptionContent"
          type="single"
          value={filters.descriptionContent ?? "all"}
        >
          <Select.Trigger
            aria-label={copy.descriptionContent}
            class="w-full"
          >
            {descriptionContentOptions.find(
              (option) =>
                option.value === (filters.descriptionContent ?? "all"),
            )?.label ?? descriptionContentOptions[0]?.label ?? ""}
          </Select.Trigger>
          <Select.Content>
            <Select.Group>
              {#each descriptionContentOptions as option}
                <Select.Item label={option.label} value={option.value}>
                  {option.label}
                </Select.Item>
              {/each}
            </Select.Group>
          </Select.Content>
        </Select.Root>
        <input type="hidden" name="status" value={filters.status ?? "all"} />
      {:else}
        <Select.Root
          name="status"
          type="single"
          value={filters.status ?? "all"}
        >
          <Select.Trigger aria-label={copy.status} class="w-full">
            {statusFilterOptions.find(
              (option) => option.value === (filters.status ?? "all"),
            )?.label ?? statusFilterOptions[0]?.label ?? ""}
          </Select.Trigger>
          <Select.Content>
            <Select.Group>
              {#each statusFilterOptions as option}
                <Select.Item label={option.label} value={option.value}>
                  {option.label}
                </Select.Item>
              {/each}
            </Select.Group>
          </Select.Content>
        </Select.Root>
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
