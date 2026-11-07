<script lang="ts">
import ChevronDown from "@lucide/svelte/icons/chevron-down";
import { onMount } from "svelte";
import ActiveFilters from "#lib/components/ActiveFilters.svelte";
import EndlessScroll from "#lib/components/EndlessScroll.svelte";
import FilterToolbar from "#lib/components/FilterToolbar.svelte";
import PageHeader from "#lib/components/PageHeader.svelte";
import PageLayout from "#lib/components/PageLayout.svelte";
import Panel from "#lib/components/Panel.svelte";
import ResponsiveCollection from "#lib/components/ResponsiveCollection.svelte";
import ResultsEmpty from "#lib/components/ResultsEmpty.svelte";
import SearchField from "#lib/components/SearchField.svelte";
import TableFilterFields from "#lib/components/TableFilterFields.svelte";
import TruncatedText from "#lib/components/TruncatedText.svelte";
import { Button } from "#lib/components/ui/button/index.js";
import * as Item from "#lib/components/ui/item/index.js";
import * as Popover from "#lib/components/ui/popover/index.js";
import * as Table from "#lib/components/ui/table/index.js";
import { createShanghaiDateTimeFormatter } from "#lib/time/shanghai-format.js";
import type { EndlessScrollState } from "@/lib/navigation/endless-list.svelte";
import { createFilterDraft } from "@/lib/navigation/filter-draft.svelte";
import { tableFilterPageHref } from "@/lib/table-filter-query";
import type { TableFilterField } from "@/lib/table-filters";
import { formatBytes } from "@/shared/lib/format-bytes";
import { afterNavigate, goto } from "$app/navigation";
import type { PageData } from "../../../routes/workspace/uploads/$types";
import UploadManageDialog from "./UploadManageDialog.svelte";

let { data, endless }: { data: PageData; endless: EndlessScrollState } =
  $props();
const copy = $derived(data.copy.uploads);
const appliedFilters = $derived(data.filters);
const draft = createFilterDraft(() => appliedFilters);
let ready = $state(false);
let filtersOpen = $state(false);
let dateOpen = $state(false);
onMount(() => {
  ready = true;
});
const fields = $derived<TableFilterField[]>([
  { name: "filename", label: copy.tableName },
  {
    name: "size",
    label: copy.tableSize,
    description: copy.filterSizeDescription,
    type: "number",
    min: 0,
    step: 1,
  },
  { name: "createdAt", label: copy.tableUploaded, type: "date" },
]);
function change(patch: Record<string, string>) {
  draft.update(patch);
}
function apply(event: SubmitEvent) {
  // Keep the portal submitter attached until SvelteKit constructs native FormData.
  draft.submit(event);
}
afterNavigate(() => {
  dateOpen = false;
});
function reset() {
  draft.update(
    Object.fromEntries(
      [
        "filename",
        "size",
        "sizeOp",
        "sizeMax",
        "createdAt",
        "createdAtOp",
        "createdAtMax",
      ].map((name) => [name, ""]),
    ),
  );
  filtersOpen = false;
  dateOpen = false;
  void goto("/workspace/uploads");
}
const activeFilters = $derived(
  fields.flatMap((field) => {
    const value = appliedFilters[field.name];
    if (!value) return [];
    const operator = appliedFilters[`${field.name}Op`] || "eq";
    const operatorLabel =
      data.copy.common.tableFilters.operators[
        operator as keyof typeof data.copy.common.tableFilters.operators
      ] ?? operator;
    const summary = field.type
      ? `${operatorLabel} ${value}${operator === "between" ? ` – ${appliedFilters[`${field.name}Max`] || ""}` : ""}`
      : value;
    const label = `${field.label}: ${summary}`;
    return [
      {
        name: field.name,
        href: tableFilterPageHref("/workspace/uploads", {
          ...appliedFilters,
          [field.name]: "",
          [`${field.name}Op`]: "",
          [`${field.name}Max`]: "",
        }),
        label,
        removeLabel: copy.removeCondition.replace("{condition}", () => label),
      },
    ];
  }),
);
function removeFilter(event: MouseEvent, href: string) {
  const name = activeFilters.find((item) => item.href === href)?.name;
  if (name) draft.remove(event, [name, `${name}Op`, `${name}Max`]);
}
const formatter = $derived(
  createShanghaiDateTimeFormatter(data.locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }),
);
type Upload = PageData["uploads"][number];
let selected = $state<{ upload: Upload; action: "rename" | "delete" } | null>(
  null,
);
</script>

<svelte:head><title>{copy.title} - Life@USTC</title></svelte:head>

{#snippet uploadActions(upload: Upload)}
  <div class="flex flex-wrap gap-2">
    <Button href={`/api/workspace/uploads/${encodeURIComponent(upload.id)}/download`} variant="outline" size="sm" aria-label={`${copy.downloadAction} ${upload.filename}`}>{copy.downloadAction}</Button>
    <Button variant="outline" size="sm" aria-label={`${copy.renameAction} ${upload.filename}`} onclick={() => selected = {upload, action:"rename"}}>{copy.renameAction}</Button>
    <Button variant="outline" size="sm" aria-label={`${copy.deleteAction} ${upload.filename}`} onclick={() => selected = {upload, action:"delete"}}>{copy.deleteAction}</Button>
  </div>
{/snippet}

{#snippet filterActions()}
  <div class="flex flex-wrap items-center gap-2" data-slot="upload-filter-actions">
    <Button type="submit" form="uploads-filters" class="h-11 md:h-8" disabled={!ready}>{data.copy.common.applyFilters}</Button>
    <Button type="button" variant="outline" class="h-11 md:h-8" disabled={!ready} onclick={reset}>{copy.reset}</Button>
  </div>
{/snippet}

<PageLayout>
  {#snippet header()}<PageHeader title={copy.title} description={copy.description} />{/snippet}
  <Panel>
    <div class="grid gap-2" aria-label={copy.usageLabel.replace("{used}", formatBytes(data.usedBytes)).replace("{total}", formatBytes(data.quotaBytes))}>
      <p class="text-sm text-muted-foreground">{copy.usageLabel.replace("{used}", formatBytes(data.usedBytes)).replace("{total}", formatBytes(data.quotaBytes))}</p>
      <p class="text-sm text-muted-foreground">{copy.fileLimit.replace("{size}", formatBytes(data.maxFileSizeBytes))}</p>
    </div>
  </Panel>
  <Panel>
    <form id="uploads-filters" action="/workspace/uploads" method="get" onsubmit={apply} data-slot="collection-header">
      {#each Object.entries(draft.values) as [name,value]}{#if value}<input type="hidden" {name} {value} />{/if}{/each}
      <FilterToolbar filterTitle={copy.moreConditions} bind:open={filtersOpen} disabled={!ready} showFilterLabel advancedBeforeActions>
        {#snippet primary()}
          <div class="w-full min-w-0 md:w-auto md:min-w-48 md:flex-1">
            <SearchField id="uploads-filename" label={copy.searchFilename} placeholder={copy.searchFilename} value={draft.values.filename ?? ""} oninput={(event) => change({filename:event.currentTarget.value})} disabled={!ready} />
          </div>
          <Popover.Root bind:open={dateOpen}>
            <Popover.Trigger>{#snippet child({props})}<Button {...props} type="button" variant="outline" class="h-11 md:h-8" disabled={!ready}>{copy.tableUploaded}<ChevronDown data-icon="inline-end" /></Button>{/snippet}</Popover.Trigger>
            <Popover.Content role="dialog" aria-label={copy.tableUploaded} align="start" class="max-h-[70dvh] w-80 max-w-[calc(100vw-2rem)] overflow-y-auto">
              <TableFilterFields fields={fields.filter((field) => field.name === "createdAt")} values={draft.values} onchange={change} labels={data.copy.common.tableFilters} idPrefix="uploads" formId="uploads-filters" />
            </Popover.Content>
          </Popover.Root>
        {/snippet}
        {#snippet advanced()}
          <TableFilterFields fields={fields.filter((field) => field.name === "size")} values={draft.values} onchange={change} labels={data.copy.common.tableFilters} idPrefix="uploads" formId="uploads-filters" />
          {#if filtersOpen}<div class="mt-4">{@render filterActions()}</div>{/if}
        {/snippet}
        {#snippet actions()}{#if !filtersOpen}{@render filterActions()}{/if}{/snippet}
      </FilterToolbar>
    </form>
    <ActiveFilters items={activeFilters} ariaLabel={copy.appliedConditions} clearHref="/workspace/uploads" clearLabel={copy.reset} showClear={false} disabled={!ready} onremove={removeFilter} />
    <p class="text-sm text-muted-foreground">{copy.newestFirst}</p>
      <ResponsiveCollection>
        {#snippet desktop()}
          <Table.Root>
            <Table.Header><Table.Row><Table.Head>{copy.tableName}</Table.Head><Table.Head>{copy.tableSize}</Table.Head><Table.Head>{copy.tableUploaded}</Table.Head><Table.Head>{copy.tableActions}</Table.Head></Table.Row></Table.Header>
            <Table.Body>
              {#each data.uploads as upload (upload.id)}
                <Table.Row>
                  <Table.Cell class="max-w-64"><TruncatedText class="font-medium" text={upload.filename} /></Table.Cell>
                  <Table.Cell class="text-left tabular-nums">{formatBytes(upload.size)}</Table.Cell>
                  <Table.Cell><time datetime={upload.createdAt}>{formatter.format(new Date(upload.createdAt))}</time></Table.Cell>
                  <Table.Cell>{@render uploadActions(upload)}</Table.Cell>
                </Table.Row>
              {/each}
              {#if data.uploads.length === 0}<Table.Row><Table.Cell colspan={4}><ResultsEmpty title={data.hasUploads ? copy.noMatchTitle : copy.emptyTitle} description={data.hasUploads ? copy.noMatchDescription : copy.emptyDescription} /></Table.Cell></Table.Row>{/if}
            </Table.Body>
          </Table.Root>
        {/snippet}
        {#snippet mobile()}
          <Item.Group role="list" class="gap-3">
            {#each data.uploads as upload (upload.id)}
              <Item.Root role="listitem" variant="outline">
                <Item.Content>
                  <p class="break-all font-medium">{upload.filename}</p>
                  <Item.Description>{formatBytes(upload.size)} · <time datetime={upload.createdAt}>{formatter.format(new Date(upload.createdAt))}</time></Item.Description>
                  {@render uploadActions(upload)}
                </Item.Content>
              </Item.Root>
            {/each}
          </Item.Group>
          {#if data.uploads.length === 0}<ResultsEmpty title={data.hasUploads ? copy.noMatchTitle : copy.emptyTitle} description={data.hasUploads ? copy.noMatchDescription : copy.emptyDescription} />{/if}
        {/snippet}
      </ResponsiveCollection>
    {#snippet footer()}
      <EndlessScroll state={endless} labels={data.copy.common.endlessScroll} />
    {/snippet}
  </Panel>
</PageLayout>
{#if selected}
  <UploadManageDialog {...selected} {copy} close={() => selected = null} />
{/if}
