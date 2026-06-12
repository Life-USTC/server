<script lang="ts">
import { Alert } from "$lib/components/ui/alert/index.js";
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
    <article class="rounded-md border border-base-300 bg-base-100 p-3" data-slot="card">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <h3 class="font-semibold leading-5">{version.title}</h3>
          <p class="break-all font-mono text-base-content/60 text-xs">
            {version.key}
          </p>
        </div>
        <AdminBusVersionStatusBadge {copy} {version} />
      </div>
      {#if version.sourceMessage}
        <p class="mt-2 text-base-content/60 text-xs">{version.sourceMessage}</p>
      {/if}
      <dl class="mt-3 grid grid-cols-2 gap-2 text-sm">
        <div>
          <dt class="text-base-content/60 text-xs">{copy.colTrips}</dt>
          <dd class="font-medium tabular-nums">{version.tripCount}</dd>
        </div>
        <div>
          <dt class="text-base-content/60 text-xs">{copy.colImported}</dt>
          <dd class="tabular-nums">{formatImportedAt(version.importedAt)}</dd>
        </div>
        <div class="col-span-2">
          <dt class="text-base-content/60 text-xs">{copy.colEffective}</dt>
          <dd class="tabular-nums">
            {formatEffectiveRange(version)}
          </dd>
        </div>
      </dl>
      <div class="mt-3 flex justify-end gap-2">
        <AdminBusVersionActions
          {copy}
          {enhancedAction}
          {isPending}
          {onDelete}
          {pendingAction}
          {version}
        />
      </div>
    </article>
  {:else}
    <Alert>{copy.noVersions}</Alert>
  {/each}
</div>
