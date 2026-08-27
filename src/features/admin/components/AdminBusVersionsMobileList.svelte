<script lang="ts">
import * as Empty from "$lib/components/ui/empty/index.js";
import * as Item from "$lib/components/ui/item/index.js";
import AdminBusVersionActions from "./AdminBusVersionActions.svelte";
import AdminBusVersionStatusBadge from "./AdminBusVersionStatusBadge.svelte";
import AdminListShell from "./AdminListShell.svelte";
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

{#if versions.length === 0}
  <Empty.Root class="min-h-20 border-0 px-2 py-6 xl:hidden">
    <Empty.Header>
      <Empty.Description>{copy.noVersions}</Empty.Description>
    </Empty.Header>
  </Empty.Root>
{:else}
  <AdminListShell class="xl:hidden">
    <Item.Group class="gap-0" data-testid="admin-bus-mobile-list">
      {#each versions as version, index (version.id)}
        <Item.Root class="items-start px-1 py-3" size="sm">
        <Item.Content class="min-w-0">
          <Item.Title title={version.title}>{version.title}</Item.Title>
          <Item.Description class="truncate font-mono" title={version.key}>{version.key}</Item.Description>
          {#if version.sourceMessage}
            <Item.Description class="truncate" title={version.sourceMessage}>{version.sourceMessage}</Item.Description>
          {/if}
        </Item.Content>
        <Item.Actions>
          <AdminBusVersionStatusBadge {copy} {version} />
        </Item.Actions>
        <Item.Footer class="block">
          <dl class="grid grid-cols-2 gap-2 text-sm">
            <div>
              <dt class="text-muted-foreground text-xs">{copy.colTrips}</dt>
              <dd class="font-medium tabular-nums">{version.tripCount}</dd>
            </div>
            <div>
              <dt class="text-muted-foreground text-xs">{copy.colImported}</dt>
              <dd class="tabular-nums">{formatImportedAt(version.importedAt)}</dd>
            </div>
            <div class="col-span-2">
              <dt class="text-muted-foreground text-xs">{copy.colEffective}</dt>
              <dd class="tabular-nums">
                {formatEffectiveRange(version)}
              </dd>
            </div>
          </dl>
          {#if !version.isEnabled}
            <div class="mt-3 flex justify-end">
              <AdminBusVersionActions
                {copy}
                {enhancedAction}
                {isPending}
                {onDelete}
                {pendingAction}
                compact
                {version}
              />
            </div>
          {/if}
        </Item.Footer>
        </Item.Root>
        {#if index < versions.length - 1}<Item.Separator class="my-0" />{/if}
      {/each}
    </Item.Group>
  </AdminListShell>
{/if}
