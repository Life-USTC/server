<script lang="ts">
import CollectionEmpty from "#lib/components/CollectionEmpty.svelte";
import CollectionListShell from "#lib/components/CollectionListShell.svelte";
import MobileListCard from "#lib/components/MobileListCard.svelte";
import * as Item from "#lib/components/ui/item/index.js";
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

{#if versions.length === 0}
  <CollectionEmpty variant="compact" description={copy.noVersions} />
{:else}
  <CollectionListShell>
    <Item.Group class="gap-0" data-testid="admin-bus-mobile-list">
      {#each versions as version, index (version.id)}
        <MobileListCard  size="sm">
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
              <dd class="text-muted-foreground tabular-nums">{version.tripCount}</dd>
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
        </MobileListCard>
        {#if index < versions.length - 1}<Item.Separator class="my-0" />{/if}
      {/each}
    </Item.Group>
  </CollectionListShell>
{/if}
