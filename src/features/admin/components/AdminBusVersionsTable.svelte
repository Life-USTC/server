<script lang="ts">
import CollectionEmpty from "#lib/components/CollectionEmpty.svelte";
import CollectionTableShell from "#lib/components/CollectionTableShell.svelte";
import TableFieldFilter from "#lib/components/TableFieldFilter.svelte";
import TruncatedText from "#lib/components/TruncatedText.svelte";
import * as Table from "#lib/components/ui/table/index.js";
import type { TableFilterField, TableFilterLabels } from "@/lib/table-filters";
import AdminBusVersionActions from "./AdminBusVersionActions.svelte";
import AdminBusVersionStatusBadge from "./AdminBusVersionStatusBadge.svelte";
import type {
  AdminBusCopy,
  AdminBusEnhancedAction,
  AdminBusVersion,
  AdminBusVersionFormatter,
} from "./admin-bus-types";

interface Props {
  columns: TableFilterField[][];
  values: Record<string, string>;
  onchange: (patch: Record<string, string>) => void;
  filterLabels: TableFilterLabels;
  copy: AdminBusCopy;
  enhancedAction: AdminBusEnhancedAction;
  formatEffectiveRange: AdminBusVersionFormatter;
  formatImportedAt: (value: string | Date) => string;
  isPending: (actionKey: string) => boolean;
  onDelete: (version: AdminBusVersion) => void;
  pendingAction: string | null;
  versions: AdminBusVersion[];
}

let {
  columns,
  values,
  onchange,
  filterLabels,
  copy,
  enhancedAction,
  formatEffectiveRange,
  formatImportedAt,
  isPending,
  onDelete,
  pendingAction,
  versions,
}: Props = $props();
</script>

{#snippet column(index: number)}
  <TableFieldFilter label={index === 3 ? copy.colEffective : columns[index][0].label} fields={columns[index]} {values} {onchange} labels={filterLabels} idPrefix={`admin-bus-desktop-${index}`} formId="admin-bus-filters" />
{/snippet}

<div class="min-w-0">
  <CollectionTableShell label={copy.colTitle}>
    <Table.Root class="w-full min-w-[68rem]">
      <Table.Header>
        <Table.Row>
          <Table.Head class="w-[25%]">{@render column(0)}</Table.Head>
          <Table.Head class="w-[17%]">{@render column(1)}</Table.Head>
          <Table.Head class="w-[9%]">{@render column(2)}</Table.Head>
          <Table.Head class="w-[18%]">{@render column(3)}</Table.Head>
          <Table.Head class="w-[14%]">{@render column(4)}</Table.Head>
          <Table.Head class="w-[10%]">{@render column(5)}</Table.Head>
          <Table.Head class="w-20 min-w-20">
            <span class="sr-only">{copy.colActions}</span>
          </Table.Head>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {#each versions as version}
          <Table.Row class="group">
            <Table.Cell class="max-w-0">
              <span class="block max-w-full" title={version.title}>
                <TruncatedText class="font-medium" text={version.title} />
              </span>
              <span class="block max-w-full" title={version.sourceMessage}>
                <TruncatedText
                  class="text-muted-foreground text-xs"
                  text={version.sourceMessage}
                />
              </span>
            </Table.Cell>
            <Table.Cell class="max-w-0">
              <span class="block max-w-full truncate font-mono text-sm" title={version.key}>
                {version.key}
              </span>
            </Table.Cell>
            <Table.Cell class="text-left tabular-nums">{version.tripCount}</Table.Cell>
            <Table.Cell class="text-muted-foreground">
              {formatEffectiveRange(version)}
            </Table.Cell>
            <Table.Cell class="whitespace-nowrap text-left tabular-nums text-muted-foreground">
              {formatImportedAt(version.importedAt)}
            </Table.Cell>
            <Table.Cell class="text-left">
              <AdminBusVersionStatusBadge {copy} {version} />
            </Table.Cell>
            <Table.Cell class="w-20 min-w-20 text-left">
              <AdminBusVersionActions
                {copy}
                {enhancedAction}
                {isPending}
                {onDelete}
                {pendingAction}
                {version}
              />
            </Table.Cell>
          </Table.Row>
        {:else}
          <Table.Row>
            <Table.Cell class="p-0" colspan={7}>
              <CollectionEmpty variant="compact" class="rounded-none" description={copy.noVersions} />
            </Table.Cell>
          </Table.Row>
        {/each}
      </Table.Body>
    </Table.Root>
  </CollectionTableShell>
</div>
