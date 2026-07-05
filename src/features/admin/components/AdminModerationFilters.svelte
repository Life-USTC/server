<script lang="ts">
import * as Card from "$lib/components/ui/card/index.js";
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

$: filterGroupClass =
  tab === "descriptions"
    ? "gap-3 md:grid md:grid-cols-[180px_180px_minmax(0,1fr)]"
    : "gap-3 md:grid md:grid-cols-[180px_minmax(0,1fr)]";
$: searchPlaceholder =
  tab === "comments" ? copy.searchPlaceholder : copy.searchAllPlaceholder;
</script>

<form method="GET">
  <Card.Root size="sm">
    <Card.Header>
      <Card.Title>{copy.filterQueue}</Card.Title>
      <Card.Description>{copy.filterQueueDescription}</Card.Description>
    </Card.Header>
    <Card.Content>
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
            <InputGroup.Input
              id="admin-moderation-search"
              name="search"
              placeholder={searchPlaceholder}
              type="search"
              value={searchQuery}
              oninput={(event: Event) => {
                searchQuery = (event.currentTarget as HTMLInputElement).value;
              }}
            />
            <InputGroup.Addon align="inline-end">
              <InputGroup.Button type="submit" variant="default" size="sm">
                {copy.filterAction}
              </InputGroup.Button>
            </InputGroup.Addon>
          </InputGroup.Root>
        </Field.Field>
      </Field.Group>
    </Card.Content>
  </Card.Root>
</form>
