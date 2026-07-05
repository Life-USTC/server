<script lang="ts">
import * as Card from "$lib/components/ui/card/index.js";
import * as Empty from "$lib/components/ui/empty/index.js";
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

<div class="grid gap-3 md:hidden">
  {#each versions as version}
    <Card.Root size="sm">
      <Card.Header>
        <Card.Title>{version.title}</Card.Title>
        <Card.Description class="break-all font-mono">{version.key}</Card.Description>
        <Card.Action>
          <AdminBusVersionStatusBadge {copy} {version} />
        </Card.Action>
      </Card.Header>
      <Card.Content class="grid gap-3">
        {#if version.sourceMessage}
          <p class="text-muted-foreground text-xs">{version.sourceMessage}</p>
        {/if}
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
      </Card.Content>
      {#if !version.isEnabled}
        <Card.Footer class="justify-end gap-2">
          <AdminBusVersionActions
            {copy}
            {enhancedAction}
            {isPending}
            {onDelete}
            {pendingAction}
            {version}
          />
        </Card.Footer>
      {/if}
    </Card.Root>
  {:else}
    <Empty.Root>
      <Empty.Header>
        <Empty.Description>{copy.noVersions}</Empty.Description>
      </Empty.Header>
    </Empty.Root>
  {/each}
</div>
