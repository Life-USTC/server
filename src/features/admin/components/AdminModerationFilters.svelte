<script lang="ts">
import SearchField from "#lib/components/SearchField.svelte";
import TableColumnHeader from "#lib/components/TableColumnHeader.svelte";
import {
  toolbarControlClass,
  toolbarSelectClass,
} from "#lib/components/toolbar-control.js";
import { Button } from "#lib/components/ui/button/index.js";
import * as Field from "#lib/components/ui/field/index.js";
import * as NativeSelect from "#lib/components/ui/native-select/index.js";
import type { AdminModerationFilterKind } from "./admin-moderation-page-types";

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
  descriptionPreview: string;
  postedIn: string;
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
export let kind: AdminModerationFilterKind;
export let viewport: "mobile" | "desktop";

let open = false;
let draft = "all";
$: if (open && kind !== "search") draft = filters[kind] ?? "all";

$: searchPlaceholder =
  tab === "comments" ? copy.searchPlaceholder : copy.searchAllPlaceholder;
$: id = `admin-moderation-${viewport}-${kind}`;
$: label =
  kind === "descriptionTarget"
    ? copy.postedIn
    : kind === "descriptionContent"
      ? copy.descriptionPreview
      : copy.status;
$: options =
  kind === "descriptionTarget"
    ? descriptionTargetOptions
    : kind === "descriptionContent"
      ? descriptionContentOptions
      : statusFilterOptions;
</script>

{#snippet filterForm()}
  <form class="flex min-w-0 flex-1 flex-wrap items-end gap-2" method="GET">
    <input type="hidden" name="tab" value={tab} />
    {#each ["status", "descriptionTarget", "descriptionContent"] as field}
      {#if field !== kind}
        <input type="hidden" name={field} value={filters[field as "status" | "descriptionTarget" | "descriptionContent"] ?? "all"} />
      {/if}
    {/each}
    {#if kind === "search"}
      <SearchField {id} name="search" label={searchPlaceholder} placeholder={searchPlaceholder} bind:value={searchQuery} />
    {:else}
      <input type="hidden" name="search" value={searchQuery} />
      <Field.Field>
        <Field.Label for={id}>{kind === "descriptionTarget" ? copy.descriptionTarget : kind === "descriptionContent" ? copy.descriptionContent : copy.status}</Field.Label>
        <NativeSelect.Root
          class="w-full {toolbarSelectClass}"
          {id}
          name={kind}
          bind:value={draft}
        >
          {#each options as option}
            <NativeSelect.Option value={option.value}>{option.label}</NativeSelect.Option>
          {/each}
        </NativeSelect.Root>
      </Field.Field>
    {/if}
    <Button class={toolbarControlClass} type="submit">{copy.filterAction}</Button>
  </form>
{/snippet}

{#if kind === "search"}
  {@render filterForm()}
{:else}
  <TableColumnHeader {label} active={Boolean(filters[kind] && filters[kind] !== "all")} align={kind === "status" && viewport === "desktop" ? "center" : "start"} bind:open>
    {@render filterForm()}
  </TableColumnHeader>
{/if}
