<script lang="ts">
import CollectionEmpty from "#lib/components/CollectionEmpty.svelte";
import CollectionTableShell from "#lib/components/CollectionTableShell.svelte";
import TruncatedText from "#lib/components/TruncatedText.svelte";
import * as Table from "#lib/components/ui/table/index.js";
import AdminBusVersionActions from "./AdminBusVersionActions.svelte";
import AdminBusVersionStatusBadge from "./AdminBusVersionStatusBadge.svelte";
import type {
  AdminBusCopy,
  AdminBusEnhancedAction,
  AdminBusVersion,
  AdminBusVersionFormatter,
} from "./admin-bus-types";

interface Props {
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

<div class="min-w-0">
  <CollectionTableShell label={copy.colTitle}>
    <Table.Root class="w-full min-w-[68rem]">
      <Table.Header>
        <Table.Row>
          <Table.Head class="w-[25%]">{copy.colTitle}</Table.Head>
          <Table.Head class="w-[17%]">{copy.colKey}</Table.Head>
          <Table.Head class="w-[9%] text-right">{copy.colTrips}</Table.Head>
          <Table.Head class="w-[18%]">{copy.colEffective}</Table.Head>
          <Table.Head class="w-[14%] text-right">{copy.colImported}</Table.Head>
          <Table.Head class="w-[10%] text-center">{copy.colStatus}</Table.Head>
          <Table.Head class="w-20 min-w-20 text-right">
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
            <Table.Cell class="text-right tabular-nums">{version.tripCount}</Table.Cell>
            <Table.Cell class="text-muted-foreground">
              {formatEffectiveRange(version)}
            </Table.Cell>
            <Table.Cell class="whitespace-nowrap text-right tabular-nums text-muted-foreground">
              {formatImportedAt(version.importedAt)}
            </Table.Cell>
            <Table.Cell class="text-center">
              <AdminBusVersionStatusBadge {copy} {version} />
            </Table.Cell>
            <Table.Cell class="w-20 min-w-20 text-right">
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
