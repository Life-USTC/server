<script lang="ts">
import TruncatedText from "$lib/components/TruncatedText.svelte";
import * as Empty from "$lib/components/ui/empty/index.js";
import * as Table from "$lib/components/ui/table/index.js";
import AdminBusVersionActions from "./AdminBusVersionActions.svelte";
import AdminBusVersionStatusBadge from "./AdminBusVersionStatusBadge.svelte";
import AdminTableShell from "./AdminTableShell.svelte";
import type {
  AdminBusCopy,
  AdminBusEnhancedAction,
  AdminBusVersion,
  AdminBusVersionFormatter,
} from "./admin-bus-types";

export let copy: AdminBusCopy;
export let enhancedAction: AdminBusEnhancedAction;
export let formatEffectiveRange: AdminBusVersionFormatter;
export let formatImportedAt: (value: string | Date) => string;
export let isPending: (actionKey: string) => boolean;
export let onDelete: (version: AdminBusVersion) => void;
export let pendingAction: string | null;
export let versions: AdminBusVersion[];
</script>

<div class="hidden min-w-0 xl:block">
  <AdminTableShell label={copy.colTitle}>
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
              <Empty.Root class="min-h-20 rounded-none border-0 px-2 py-6">
                <Empty.Header>
                  <Empty.Description>{copy.noVersions}</Empty.Description>
                </Empty.Header>
              </Empty.Root>
            </Table.Cell>
          </Table.Row>
        {/each}
      </Table.Body>
    </Table.Root>
  </AdminTableShell>
</div>
