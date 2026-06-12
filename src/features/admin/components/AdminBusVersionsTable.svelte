<script lang="ts">
import * as Table from "$lib/components/ui/table/index.js";
import AdminBusVersionActions from "./AdminBusVersionActions.svelte";
import AdminBusVersionStatusBadge from "./AdminBusVersionStatusBadge.svelte";
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

<div class="hidden md:block">
  <Table.Root>
    <Table.Header>
      <Table.Row>
        <Table.Head>{copy.colTitle}</Table.Head>
        <Table.Head>{copy.colKey}</Table.Head>
        <Table.Head>{copy.colTrips}</Table.Head>
        <Table.Head>{copy.colEffective}</Table.Head>
        <Table.Head>{copy.colImported}</Table.Head>
        <Table.Head>{copy.colStatus}</Table.Head>
        <Table.Head class="text-right">{copy.colActions}</Table.Head>
      </Table.Row>
    </Table.Header>
    <Table.Body>
      {#each versions as version}
        <Table.Row>
          <Table.Cell>
            <div class="font-medium">{version.title}</div>
            {#if version.sourceMessage}<div class="text-base-content/60 text-xs">{version.sourceMessage}</div>{/if}
          </Table.Cell>
          <Table.Cell class="font-mono text-xs">{version.key}</Table.Cell>
          <Table.Cell>{version.tripCount}</Table.Cell>
          <Table.Cell>{formatEffectiveRange(version)}</Table.Cell>
          <Table.Cell>{formatImportedAt(version.importedAt)}</Table.Cell>
          <Table.Cell>
            <AdminBusVersionStatusBadge {copy} {version} />
          </Table.Cell>
          <Table.Cell>
            <div class="flex justify-end gap-2">
              <AdminBusVersionActions
                {copy}
                {enhancedAction}
                {isPending}
                {onDelete}
                {pendingAction}
                {version}
              />
            </div>
          </Table.Cell>
        </Table.Row>
      {:else}
        <Table.Row><Table.Cell colspan={7}>{copy.noVersions}</Table.Cell></Table.Row>
      {/each}
    </Table.Body>
  </Table.Root>
</div>
