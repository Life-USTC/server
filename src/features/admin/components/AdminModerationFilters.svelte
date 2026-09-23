<script lang="ts">
import SearchIcon from "@lucide/svelte/icons/search";
import { onMount } from "svelte";
import { mountPageSearchShortcut } from "@/lib/browser/page-search-shortcut";
import PageSearchShortcutHint from "$lib/components/shell/PageSearchShortcutHint.svelte";
import { Button } from "$lib/components/ui/button/index.js";
import * as Field from "$lib/components/ui/field/index.js";
import * as InputGroup from "$lib/components/ui/input-group/index.js";
import * as NativeSelect from "$lib/components/ui/native-select/index.js";

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

let searchInput: HTMLInputElement | null = null;

$: filterGroupClass =
  tab === "descriptions"
    ? "gap-3 md:grid md:grid-cols-[180px_180px_minmax(0,1fr)_auto] md:items-end"
    : "gap-3 md:grid md:grid-cols-[180px_minmax(0,1fr)_auto] md:items-end";
$: searchPlaceholder =
  tab === "comments" ? copy.searchPlaceholder : copy.searchAllPlaceholder;

onMount(() => mountPageSearchShortcut(() => searchInput));
</script>

<form class="grid min-w-0 gap-3" method="GET">
  <input type="hidden" name="tab" value={tab} />
  <Field.Group class={filterGroupClass}>
    {#if tab === "descriptions"}
      <Field.Field>
        <Field.Label for="admin-moderation-description-target">
          {copy.descriptionTarget}
        </Field.Label>
        <NativeSelect.Root
          class="w-full"
          id="admin-moderation-description-target"
          name="descriptionTarget"
          value={filters.descriptionTarget ?? "all"}
        >
          {#each descriptionTargetOptions as option}
            <NativeSelect.Option value={option.value}>
              {option.label}
            </NativeSelect.Option>
          {/each}
        </NativeSelect.Root>
      </Field.Field>
      <Field.Field>
        <Field.Label for="admin-moderation-description-content">
          {copy.descriptionContent}
        </Field.Label>
        <NativeSelect.Root
          class="w-full"
          id="admin-moderation-description-content"
          name="descriptionContent"
          value={filters.descriptionContent ?? "all"}
        >
          {#each descriptionContentOptions as option}
            <NativeSelect.Option value={option.value}>
              {option.label}
            </NativeSelect.Option>
          {/each}
        </NativeSelect.Root>
      </Field.Field>
      <input type="hidden" name="status" value={filters.status ?? "all"} />
    {:else}
      <Field.Field>
        <Field.Label for="admin-moderation-status">{copy.status}</Field.Label>
        <NativeSelect.Root
          class="w-full"
          id="admin-moderation-status"
          name="status"
          value={filters.status ?? "all"}
        >
          {#each statusFilterOptions as option}
            <NativeSelect.Option value={option.value}>
              {option.label}
            </NativeSelect.Option>
          {/each}
        </NativeSelect.Root>
      </Field.Field>
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
    <Field.Field>
      <Field.Label class="sr-only" for="admin-moderation-search">
        {searchPlaceholder}
      </Field.Label>
      <InputGroup.Root>
        <InputGroup.Addon>
          <SearchIcon aria-hidden="true" />
        </InputGroup.Addon>
        <InputGroup.Input
          id="admin-moderation-search"
          bind:ref={searchInput}
          name="search"
          placeholder={searchPlaceholder}
          type="search"
          value={searchQuery}
          oninput={(event: Event) => {
            searchQuery = (event.currentTarget as HTMLInputElement).value;
          }}
        />
        <InputGroup.Addon class="hidden sm:flex" align="inline-end">
          <PageSearchShortcutHint />
        </InputGroup.Addon>
      </InputGroup.Root>
    </Field.Field>
    <Button class="w-full md:w-auto" type="submit">
      {copy.filterAction}
    </Button>
  </Field.Group>
</form>
