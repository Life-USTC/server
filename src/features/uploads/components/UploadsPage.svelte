<script lang="ts">
import { formatBytes } from "@/shared/lib/format-bytes";
import ListPagination from "$lib/components/ListPagination.svelte";
import PageHeader from "$lib/components/PageHeader.svelte";
import PageLayout from "$lib/components/PageLayout.svelte";
import Panel from "$lib/components/Panel.svelte";
import ResponsiveCollection from "$lib/components/ResponsiveCollection.svelte";
import ResultsEmpty from "$lib/components/ResultsEmpty.svelte";
import TruncatedText from "$lib/components/TruncatedText.svelte";
import { Button } from "$lib/components/ui/button";
import * as Item from "$lib/components/ui/item";
import * as Table from "$lib/components/ui/table";
import { createShanghaiDateTimeFormatter } from "$lib/time/shanghai-format";
import type { PageData } from "../../../routes/workspace/uploads/$types";
import UploadManageDialog from "./UploadManageDialog.svelte";

let { data }: { data: PageData } = $props();
const copy = $derived(data.copy.uploads);
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

<svelte:head><title>{copy.title}</title></svelte:head>

{#snippet actions(upload: Upload)}
  <div class="flex flex-wrap gap-2">
    <Button href={`/api/workspace/uploads/${encodeURIComponent(upload.id)}/download`} variant="outline" size="sm" aria-label={`${copy.downloadAction} ${upload.filename}`}>{copy.downloadAction}</Button>
    <Button variant="outline" size="sm" aria-label={`${copy.renameAction} ${upload.filename}`} onclick={() => selected = {upload, action:"rename"}}>{copy.renameAction}</Button>
    <Button variant="outline" size="sm" aria-label={`${copy.deleteAction} ${upload.filename}`} onclick={() => selected = {upload, action:"delete"}}>{copy.deleteAction}</Button>
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
    {#if data.uploads.length === 0}
      <ResultsEmpty title={copy.emptyTitle} description={copy.emptyDescription} />
    {:else}
      <ResponsiveCollection>
        {#snippet desktop()}
          <Table.Root>
            <Table.Header><Table.Row><Table.Head>{copy.tableName}</Table.Head><Table.Head class="text-right">{copy.tableSize}</Table.Head><Table.Head>{copy.tableUploaded}</Table.Head><Table.Head>{copy.tableActions}</Table.Head></Table.Row></Table.Header>
            <Table.Body>
              {#each data.uploads as upload (upload.id)}
                <Table.Row>
                  <Table.Cell class="max-w-64"><TruncatedText class="font-medium" text={upload.filename} /></Table.Cell>
                  <Table.Cell class="text-right tabular-nums">{formatBytes(upload.size)}</Table.Cell>
                  <Table.Cell><time datetime={upload.createdAt}>{formatter.format(new Date(upload.createdAt))}</time></Table.Cell>
                  <Table.Cell>{@render actions(upload)}</Table.Cell>
                </Table.Row>
              {/each}
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
                  {@render actions(upload)}
                </Item.Content>
              </Item.Root>
            {/each}
          </Item.Group>
        {/snippet}
      </ResponsiveCollection>
    {/if}
    {#snippet footer()}
      <ListPagination ariaLabel={data.copy.common.pagination} nextLabel={data.copy.common.next} nextPageLabel={data.copy.common.nextPage} previousLabel={data.copy.common.previous} previousPageLabel={data.copy.common.previousPage} page={data.page} totalPages={data.totalPages} pageHref={(page) => `/workspace/uploads?page=${page}`} />
    {/snippet}
  </Panel>
</PageLayout>
{#if selected}
  <UploadManageDialog {...selected} {copy} close={() => selected = null} />
{/if}
