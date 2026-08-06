<script lang="ts">
import SoftEmptyMessage from "$lib/components/SoftEmptyMessage.svelte";
import TruncatedText from "$lib/components/TruncatedText.svelte";
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

<div class="hidden min-w-0 md:block">
  <Table.Root class="w-full">
    <Table.Header>
      <Table.Row>
        <Table.Head>{copy.colTitle}</Table.Head>
        <Table.Head>{copy.colKey}</Table.Head>
        <Table.Head>{copy.colTrips}</Table.Head>
        <Table.Head>{copy.colEffective}</Table.Head>
        <Table.Head>{copy.colImported}</Table.Head>
        <Table.Head>{copy.colStatus}</Table.Head>
        <Table.Head>
          <span class="sr-only">{copy.colActions}</span>
        </Table.Head>
      </Table.Row>
    </Table.Header>
    <Table.Body>
      {#each versions as version}
        <Table.Row class="group">
          <Table.Cell>
            <TruncatedText class="font-medium" text={version.title} />
            <TruncatedText
              class="text-muted-foreground text-xs"
              text={version.sourceMessage}
            />
          </Table.Cell>
          <Table.Cell>
            <span class="font-mono text-sm">{version.key}</span>
          </Table.Cell>
          <Table.Cell class="tabular-nums">{version.tripCount}</Table.Cell>
          <Table.Cell class="text-muted-foreground">
            {formatEffectiveRange(version)}
          </Table.Cell>
          <Table.Cell class="whitespace-nowrap tabular-nums text-muted-foreground">
            {formatImportedAt(version.importedAt)}
          </Table.Cell>
          <Table.Cell>
            <AdminBusVersionStatusBadge {copy} {version} />
          </Table.Cell>
          <Table.Cell>
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
            <div class="px-2 py-6">
              <SoftEmptyMessage message={copy.noVersions} />
            </div>
          </Table.Cell>
        </Table.Row>
      {/each}
    </Table.Body>
  </Table.Root>
</div>
